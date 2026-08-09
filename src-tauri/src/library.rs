use serde::Serialize;
use std::ffi::OsStr;
use std::fs::{self, OpenOptions};
use std::io::{Read as _, Write as _};
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

type CommandResult<T> = Result<T, CommandError>;

const SNIPPET_READ_BYTES: u64 = 4096;
const SNIPPET_MAX_CHARS: usize = 160;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandError {
    code: &'static str,
    message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySnapshot {
    pub folders: Vec<FolderEntry>,
    pub documents: Vec<DocumentEntry>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderEntry {
    pub path: String,
    pub parent: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentEntry {
    pub path: String,
    pub parent: String,
    pub title: String,
    pub updated_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentPayload {
    pub path: String,
    pub content: String,
    pub mtime_ms: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSnippet {
    pub path: String,
    pub snippet: Option<String>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSource {
    pub root: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryMutation {
    pub path: String,
}

#[tauri::command]
pub fn scan_library(root: String) -> CommandResult<LibrarySnapshot> {
    let canonical_root = canonical_root(Path::new(&root))?;
    let mut folders = Vec::new();
    let mut documents = Vec::new();
    scan_directory(
        &canonical_root,
        &canonical_root,
        &mut folders,
        &mut documents,
    )?;
    folders.sort_by(|left, right| left.path.cmp(&right.path));
    documents.sort_by(|left, right| {
        right
            .updated_ms
            .cmp(&left.updated_ms)
            .then_with(|| left.path.cmp(&right.path))
    });
    Ok(LibrarySnapshot { folders, documents })
}

#[tauri::command]
pub fn read_document(root: String, path: String) -> CommandResult<DocumentPayload> {
    let canonical_root = canonical_root(Path::new(&root))?;
    let target = resolve_existing(&canonical_root, Path::new(&path), false)?;
    ensure_markdown_file(&target)?;
    payload(&canonical_root, &target)
}

#[tauri::command]
pub fn read_document_snippets(
    root: String,
    paths: Vec<String>,
) -> CommandResult<Vec<DocumentSnippet>> {
    let canonical_root = canonical_root(Path::new(&root))?;
    paths
        .into_iter()
        .map(|path| document_snippet(&canonical_root, &path))
        .collect()
}

#[tauri::command]
pub fn create_document(
    root: String,
    parent: String,
    title: String,
    content: String,
) -> CommandResult<DocumentPayload> {
    validate_name(&title)?;
    let canonical_root = canonical_root(Path::new(&root))?;
    let parent_path = resolve_existing(&canonical_root, Path::new(&parent), true)?;
    ensure_directory(&parent_path)?;
    let target = parent_path.join(format!("{title}.md"));
    ensure_available(&target)?;
    atomic_save(&target, &content, None)?;
    payload(&canonical_root, &target)
}

#[tauri::command]
pub fn save_document(
    root: String,
    path: String,
    content: String,
    expected_mtime_ms: u64,
) -> CommandResult<DocumentPayload> {
    let canonical_root = canonical_root(Path::new(&root))?;
    let target = resolve_existing(&canonical_root, Path::new(&path), false)?;
    ensure_markdown_file(&target)?;
    atomic_save(&target, &content, Some(expected_mtime_ms))?;
    payload(&canonical_root, &target)
}

#[tauri::command]
pub fn rename_document(
    root: String,
    path: String,
    title: String,
    content: String,
    expected_mtime_ms: u64,
) -> CommandResult<DocumentPayload> {
    validate_name(&title)?;
    let canonical_root = canonical_root(Path::new(&root))?;
    let source = resolve_existing(&canonical_root, Path::new(&path), false)?;
    ensure_markdown_file(&source)?;
    ensure_expected_mtime(&source, expected_mtime_ms)?;
    let parent = source
        .parent()
        .ok_or_else(|| error("invalid-path", "Document has no parent directory"))?;
    let target = parent.join(format!("{title}.md"));

    if source == target {
        atomic_save(&source, &content, Some(expected_mtime_ms))?;
        return payload(&canonical_root, &source);
    }

    ensure_available(&target)?;
    fs::rename(&source, &target)
        .map_err(|cause| io_error("rename-failed", "Could not rename document", cause))?;

    if let Err(save_error) = atomic_save(&target, &content, None) {
        return match fs::rename(&target, &source) {
            Ok(()) => Err(save_error),
            Err(rollback_error) => Err(error(
                "rollback-failed",
                format!(
                    "Rename save failed and rollback also failed: {}; {}",
                    save_error.message, rollback_error
                ),
            )),
        };
    }

    payload(&canonical_root, &target)
}

#[tauri::command]
pub fn create_folder(root: String, parent: String, name: String) -> CommandResult<EntryMutation> {
    validate_name(&name)?;
    let canonical_root = canonical_root(Path::new(&root))?;
    let parent_path = resolve_existing(&canonical_root, Path::new(&parent), true)?;
    ensure_directory(&parent_path)?;
    let target = parent_path.join(name);
    ensure_available(&target)?;
    fs::create_dir(&target)
        .map_err(|cause| io_error("create-failed", "Could not create folder", cause))?;
    mutation(&canonical_root, &target)
}

#[tauri::command]
pub fn rename_folder(root: String, path: String, name: String) -> CommandResult<EntryMutation> {
    validate_name(&name)?;
    let canonical_root = canonical_root(Path::new(&root))?;
    let source = resolve_existing(&canonical_root, Path::new(&path), false)?;
    ensure_directory(&source)?;
    let parent = source
        .parent()
        .ok_or_else(|| error("invalid-path", "Folder has no parent directory"))?;
    let target = parent.join(name);
    if source == target {
        return mutation(&canonical_root, &source);
    }
    ensure_available(&target)?;
    fs::rename(&source, &target)
        .map_err(|cause| io_error("rename-failed", "Could not rename folder", cause))?;
    mutation(&canonical_root, &target)
}

#[tauri::command]
pub fn move_entry(root: String, path: String, destination: String) -> CommandResult<EntryMutation> {
    let canonical_root = canonical_root(Path::new(&root))?;
    let source = resolve_existing(&canonical_root, Path::new(&path), false)?;
    let destination_path = resolve_existing(&canonical_root, Path::new(&destination), true)?;
    ensure_directory(&destination_path)?;
    if source.is_dir() && destination_path.starts_with(&source) {
        return Err(error(
            "invalid-move",
            "A folder cannot be moved into itself",
        ));
    }
    let file_name = source
        .file_name()
        .ok_or_else(|| error("invalid-path", "Entry has no file name"))?;
    let target = destination_path.join(file_name);
    if source == target {
        return mutation(&canonical_root, &source);
    }
    ensure_available(&target)?;
    fs::rename(&source, &target)
        .map_err(|cause| io_error("move-failed", "Could not move entry", cause))?;
    mutation(&canonical_root, &target)
}

#[tauri::command]
pub fn trash_entry(root: String, path: String) -> CommandResult<()> {
    let canonical_root = canonical_root(Path::new(&root))?;
    let target = resolve_existing(&canonical_root, Path::new(&path), false)?;
    trash::delete(&target).map_err(|cause| {
        error(
            "trash-failed",
            format!("Could not move entry to Trash: {cause}"),
        )
    })
}

fn scan_directory(
    root: &Path,
    current: &Path,
    folders: &mut Vec<FolderEntry>,
    documents: &mut Vec<DocumentEntry>,
) -> CommandResult<()> {
    let entries = fs::read_dir(current)
        .map_err(|cause| io_error("read-failed", "Could not read library directory", cause))?;
    for entry_result in entries {
        let entry = entry_result
            .map_err(|cause| io_error("read-failed", "Could not read library entry", cause))?;
        let name = match entry.file_name().to_str() {
            Some(name) if !name.starts_with('.') => name.to_owned(),
            Some(_) | None => continue,
        };
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)
            .map_err(|cause| io_error("read-failed", "Could not inspect library entry", cause))?;
        if metadata.file_type().is_symlink() {
            continue;
        }

        if metadata.is_dir() {
            let relative = relative_string(root, &path)?;
            folders.push(FolderEntry {
                parent: parent_string(Path::new(&relative)),
                path: relative,
                name,
            });
            scan_directory(root, &path, folders, documents)?;
        } else if metadata.is_file() && path.extension() == Some(OsStr::new("md")) {
            let relative = relative_string(root, &path)?;
            let title = path
                .file_stem()
                .and_then(OsStr::to_str)
                .ok_or_else(|| error("invalid-path", "Document file name is not valid UTF-8"))?
                .to_owned();
            documents.push(DocumentEntry {
                parent: parent_string(Path::new(&relative)),
                path: relative,
                title,
                updated_ms: modified_millis(&path)?,
            });
        }
    }
    Ok(())
}

fn document_snippet(root: &Path, path: &str) -> CommandResult<DocumentSnippet> {
    let normalized = normalize_relative(Path::new(path), false)?;
    if normalized.extension() != Some(OsStr::new("md")) {
        return Err(error("invalid-document", "Expected a Markdown file"));
    }
    let relative = relative_string(root, &root.join(&normalized))?;
    let candidate = root.join(normalized);
    let metadata = match fs::symlink_metadata(&candidate) {
        Ok(metadata) => metadata,
        Err(_) => {
            return Ok(DocumentSnippet {
                path: relative,
                snippet: None,
            });
        }
    };
    if metadata.file_type().is_symlink() {
        return Err(error("symlink", "Symbolic links are not allowed"));
    }
    if !metadata.is_file() {
        return Err(error("invalid-document", "Expected a Markdown file"));
    }
    let canonical = match fs::canonicalize(&candidate) {
        Ok(canonical) => canonical,
        Err(_) => {
            return Ok(DocumentSnippet {
                path: relative,
                snippet: None,
            });
        }
    };
    if !canonical.starts_with(root) {
        return Err(error(
            "outside-library",
            "Entry is outside the library root",
        ));
    }

    let file = match fs::File::open(&canonical) {
        Ok(file) => file,
        Err(_) => {
            return Ok(DocumentSnippet {
                path: relative,
                snippet: None,
            });
        }
    };
    let mut bytes = Vec::with_capacity(SNIPPET_READ_BYTES as usize);
    if file
        .take(SNIPPET_READ_BYTES)
        .read_to_end(&mut bytes)
        .is_err()
    {
        return Ok(DocumentSnippet {
            path: relative,
            snippet: None,
        });
    }
    let content = String::from_utf8_lossy(&bytes);
    Ok(DocumentSnippet {
        path: relative,
        snippet: Some(extract_snippet(&content)),
    })
}

fn extract_snippet(markdown: &str) -> String {
    let lines = markdown.lines().collect::<Vec<_>>();
    let start = if lines.first().is_some_and(|line| line.trim() == "---") {
        lines
            .iter()
            .enumerate()
            .skip(1)
            .find_map(|(index, line)| (line.trim() == "---").then_some(index + 1))
            .unwrap_or(0)
    } else {
        0
    };
    let body = lines[start..]
        .iter()
        .map(|line| strip_markdown_prefix(line))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    body.chars().take(SNIPPET_MAX_CHARS).collect()
}

fn strip_markdown_prefix(line: &str) -> &str {
    let mut text = line.trim();
    if text.starts_with('#') {
        text = text.trim_start_matches('#').trim_start();
    }
    for marker in ["> ", "- ", "* ", "+ "] {
        if let Some(rest) = text.strip_prefix(marker) {
            text = rest.trim_start();
            break;
        }
    }
    if let Some((prefix, rest)) = text.split_once(". ")
        && prefix.chars().all(|character| character.is_ascii_digit())
    {
        text = rest.trim_start();
    }
    if text.starts_with("```") {
        text = text.trim_start_matches('`').trim_start();
    }
    text
}

fn canonical_root(root: &Path) -> CommandResult<PathBuf> {
    if !root.is_absolute() {
        return Err(error(
            "invalid-root",
            "Library root must be an absolute path",
        ));
    }
    let metadata = fs::symlink_metadata(root)
        .map_err(|cause| io_error("invalid-root", "Could not inspect library root", cause))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(error(
            "invalid-root",
            "Library root must be a real directory, not a symlink",
        ));
    }
    fs::canonicalize(root)
        .map_err(|cause| io_error("invalid-root", "Could not resolve library root", cause))
}

#[tauri::command]
pub fn resolve_document_source(path: String) -> CommandResult<DocumentSource> {
    let candidate = Path::new(&path);
    if !candidate.is_absolute() {
        return Err(error(
            "invalid-document-source",
            "Document source must be an absolute path",
        ));
    }
    let canonical = fs::canonicalize(candidate).map_err(|cause| {
        io_error(
            "invalid-document-source",
            "Could not resolve document source",
            cause,
        )
    })?;
    ensure_markdown_file(&canonical)?;
    if has_hidden_component(&canonical) {
        return Err(error("hidden-path", "Hidden paths are not allowed"));
    }
    let parent = canonical
        .parent()
        .ok_or_else(|| error("invalid-document-source", "Document source has no parent"))?;
    let root = parent.to_str().map(str::to_owned).ok_or_else(|| {
        error(
            "invalid-document-source",
            "Source path must use valid UTF-8",
        )
    })?;
    let path = canonical
        .file_name()
        .and_then(OsStr::to_str)
        .map(str::to_owned)
        .ok_or_else(|| error("invalid-document-source", "File name must use valid UTF-8"))?;
    Ok(DocumentSource { root, path })
}

fn has_hidden_component(path: &Path) -> bool {
    path.components().any(|component| match component {
        Component::Normal(value) => value.to_str().is_some_and(|name| name.starts_with('.')),
        Component::Prefix(_) | Component::RootDir | Component::CurDir | Component::ParentDir => {
            false
        }
    })
}

fn normalize_relative(path: &Path, allow_empty: bool) -> CommandResult<PathBuf> {
    if path.is_absolute() {
        return Err(error(
            "outside-library",
            "Absolute entry paths are not allowed",
        ));
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => {
                let name = value
                    .to_str()
                    .ok_or_else(|| error("invalid-path", "Path must use valid UTF-8"))?;
                if name.starts_with('.') {
                    return Err(error("hidden-path", "Hidden paths are not allowed"));
                }
                normalized.push(value);
            }
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err(error("outside-library", "Path traversal is not allowed"));
            }
        }
    }
    if normalized.as_os_str().is_empty() && !allow_empty {
        return Err(error("invalid-path", "Library root cannot be modified"));
    }
    Ok(normalized)
}

fn resolve_existing(root: &Path, relative: &Path, allow_root: bool) -> CommandResult<PathBuf> {
    let normalized = normalize_relative(relative, allow_root)?;
    let candidate = root.join(normalized);
    let metadata = fs::symlink_metadata(&candidate)
        .map_err(|cause| io_error("not-found", "Library entry does not exist", cause))?;
    if metadata.file_type().is_symlink() {
        return Err(error("symlink", "Symbolic links are not allowed"));
    }
    let canonical = fs::canonicalize(&candidate)
        .map_err(|cause| io_error("not-found", "Could not resolve library entry", cause))?;
    if !canonical.starts_with(root) {
        return Err(error(
            "outside-library",
            "Entry is outside the library root",
        ));
    }
    Ok(canonical)
}

fn validate_name(name: &str) -> CommandResult<()> {
    if name.trim().is_empty()
        || name.starts_with('.')
        || name.contains('/')
        || name.contains('\\')
        || name.contains(':')
        || name.chars().any(char::is_control)
    {
        return Err(error(
            "invalid-name",
            "Name cannot be empty, hidden, or contain path separators",
        ));
    }
    Ok(())
}

fn ensure_directory(path: &Path) -> CommandResult<()> {
    if !path.is_dir() {
        return Err(error("invalid-path", "Expected a directory"));
    }
    Ok(())
}

fn ensure_markdown_file(path: &Path) -> CommandResult<()> {
    if !path.is_file() || path.extension() != Some(OsStr::new("md")) {
        return Err(error("invalid-document", "Expected a Markdown file"));
    }
    Ok(())
}

fn ensure_available(path: &Path) -> CommandResult<()> {
    if path.exists() {
        return Err(error("collision", "An entry with that name already exists"));
    }
    Ok(())
}

fn ensure_expected_mtime(path: &Path, expected_mtime_ms: u64) -> CommandResult<()> {
    let current = modified_millis(path)?;
    if current != expected_mtime_ms {
        return Err(error(
            "external-change",
            "The document changed on disk after it was opened",
        ));
    }
    Ok(())
}

fn atomic_save(path: &Path, content: &str, expected_mtime_ms: Option<u64>) -> CommandResult<u64> {
    if let Some(expected) = expected_mtime_ms {
        ensure_expected_mtime(path, expected)?;
    }
    let parent = path
        .parent()
        .ok_or_else(|| error("invalid-path", "Document has no parent directory"))?;
    let file_name = path
        .file_name()
        .and_then(OsStr::to_str)
        .ok_or_else(|| error("invalid-path", "Document file name is not valid UTF-8"))?;
    let temporary = parent.join(format!(
        ".intent-memo-{}-{file_name}.tmp",
        std::process::id()
    ));

    let write_result = (|| -> std::io::Result<()> {
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        fs::rename(&temporary, path)?;
        Ok(())
    })();

    if let Err(write_error) = write_result {
        if temporary.exists() {
            fs::remove_file(&temporary).map_err(|cleanup_error| {
                error(
                    "cleanup-failed",
                    format!(
                        "Save failed and temporary file cleanup failed: {write_error}; {cleanup_error}"
                    ),
                )
            })?;
        }
        return Err(io_error(
            "write-failed",
            "Could not save document",
            write_error,
        ));
    }

    modified_millis(path)
}

fn payload(root: &Path, path: &Path) -> CommandResult<DocumentPayload> {
    let content = fs::read_to_string(path)
        .map_err(|cause| io_error("read-failed", "Could not read document", cause))?;
    Ok(DocumentPayload {
        path: relative_string(root, path)?,
        content,
        mtime_ms: modified_millis(path)?,
    })
}

fn mutation(root: &Path, path: &Path) -> CommandResult<EntryMutation> {
    Ok(EntryMutation {
        path: relative_string(root, path)?,
    })
}

fn modified_millis(path: &Path) -> CommandResult<u64> {
    let modified = fs::metadata(path)
        .and_then(|metadata| metadata.modified())
        .map_err(|cause| io_error("read-failed", "Could not read modification time", cause))?;
    let duration = modified
        .duration_since(UNIX_EPOCH)
        .map_err(|cause| error("read-failed", format!("Invalid modification time: {cause}")))?;
    u64::try_from(duration.as_millis()).map_err(|cause| {
        error(
            "read-failed",
            format!("Modification time is too large: {cause}"),
        )
    })
}

fn relative_string(root: &Path, path: &Path) -> CommandResult<String> {
    let relative = path.strip_prefix(root).map_err(|cause| {
        error(
            "outside-library",
            format!("Entry is outside library: {cause}"),
        )
    })?;
    Ok(relative
        .components()
        .filter_map(|component| match component {
            Component::Normal(value) => value.to_str(),
            Component::Prefix(_)
            | Component::RootDir
            | Component::CurDir
            | Component::ParentDir => None,
        })
        .collect::<Vec<_>>()
        .join("/"))
}

fn parent_string(relative: &Path) -> String {
    relative
        .parent()
        .map(|parent| {
            parent
                .components()
                .filter_map(|component| match component {
                    Component::Normal(value) => value.to_str(),
                    Component::Prefix(_)
                    | Component::RootDir
                    | Component::CurDir
                    | Component::ParentDir => None,
                })
                .collect::<Vec<_>>()
                .join("/")
        })
        .unwrap_or_default()
}

fn error(code: &'static str, message: impl Into<String>) -> CommandError {
    CommandError {
        code,
        message: message.into(),
    }
}

fn io_error(code: &'static str, context: &str, cause: std::io::Error) -> CommandError {
    error(code, format!("{context}: {cause}"))
}

#[cfg(test)]
mod tests {
    use super::{
        atomic_save, create_document, create_folder, extract_snippet, move_entry,
        normalize_relative, read_document_snippets, rename_document, resolve_document_source,
        scan_library,
    };
    use std::fs;
    use std::path::Path;
    use std::thread;
    use std::time::Duration;
    use tempfile::tempdir;

    #[test]
    fn resolves_an_open_markdown_file_to_its_canonical_parent_and_name() {
        let directory = tempfile::Builder::new()
            .prefix("intent-memo-")
            .tempdir()
            .expect("temporary directory");
        let root = directory.path().join("project");
        fs::create_dir(&root).expect("project directory");
        let document = root.join("note.md");
        fs::write(&document, "note").expect("document file");

        let source = resolve_document_source(document.to_string_lossy().to_string())
            .expect("document source");
        assert_eq!(
            source.root,
            fs::canonicalize(&root)
                .expect("canonical parent")
                .to_string_lossy()
        );
        assert_eq!(source.path, "note.md");
        #[cfg(unix)]
        {
            let alias = directory.path().join("note-alias.md");
            std::os::unix::fs::symlink(&document, &alias).expect("document alias");
            let alias_source = resolve_document_source(alias.to_string_lossy().to_string())
                .expect("aliased document source");
            assert_eq!(alias_source, source);
        }
        assert!(
            resolve_document_source(root.to_string_lossy().to_string()).is_err(),
            "directories are not document sources"
        );
        let text = root.join("note.txt");
        fs::write(&text, "text").expect("text file");
        assert!(resolve_document_source(text.to_string_lossy().to_string()).is_err());
    }

    #[test]
    fn resolve_document_source_rejects_a_hidden_markdown_file() {
        // Given: an absolute Markdown file whose canonical file name is hidden.
        let directory = tempfile::Builder::new()
            .prefix("intent-memo-")
            .tempdir()
            .expect("temporary directory");
        let document = directory.path().join(".hidden.md");
        fs::write(&document, "hidden").expect("hidden document");

        // When: the file is resolved as an AI document source.
        let error = resolve_document_source(document.to_string_lossy().to_string())
            .expect_err("hidden document source must be rejected");

        // Then: the existing hidden-path contract rejects it.
        assert_eq!(error.code, "hidden-path");
    }

    #[test]
    fn resolve_document_source_rejects_a_visible_markdown_file_inside_a_hidden_directory() {
        // Given: a visible Markdown file beneath a hidden canonical directory.
        let directory = tempfile::Builder::new()
            .prefix("intent-memo-")
            .tempdir()
            .expect("temporary directory");
        let hidden_directory = directory.path().join(".hidden");
        fs::create_dir(&hidden_directory).expect("hidden directory");
        let document = hidden_directory.join("note.md");
        fs::write(&document, "hidden parent").expect("document inside hidden directory");

        // When: the file is resolved as an AI document source.
        let error = resolve_document_source(document.to_string_lossy().to_string())
            .expect_err("document source inside hidden directory must be rejected");

        // Then: the existing hidden-path contract rejects it.
        assert_eq!(error.code, "hidden-path");
    }

    #[test]
    fn rejects_paths_that_escape_or_hide_inside_the_library() {
        assert!(normalize_relative(Path::new("../outside.md"), false).is_err());
        assert!(normalize_relative(Path::new(".hidden/note.md"), false).is_err());
        assert!(normalize_relative(Path::new("/absolute.md"), false).is_err());
        assert!(normalize_relative(Path::new("notes/intent.md"), false).is_ok());
    }

    #[test]
    fn snippet_excludes_frontmatter_and_leading_markdown_markers() {
        let body = "한".repeat(200);
        let markdown = format!("---\ntitle: hidden\n---\n# {body}");

        let snippet = extract_snippet(&markdown);

        assert_eq!(snippet.chars().count(), 160);
        assert!(!snippet.contains("title: hidden"));
        assert!(!snippet.starts_with('#'));
    }

    #[test]
    fn snippet_batch_returns_requested_markdown_paths() {
        let directory = tempdir().expect("temporary directory");
        let root_path = directory.path();
        fs::write(root_path.join("a.md"), "# Alpha").expect("alpha note");
        fs::write(root_path.join("b.md"), "> Beta").expect("beta note");
        fs::write(root_path.join("ignored.txt"), "ignored").expect("ignored file");

        let snippets = read_document_snippets(
            root_path.to_string_lossy().to_string(),
            vec!["b.md".to_owned(), "a.md".to_owned()],
        )
        .expect("snippet batch");

        assert_eq!(snippets.len(), 2);
        assert_eq!(snippets[0].path, "b.md");
        assert_eq!(snippets[0].snippet.as_deref(), Some("Beta"));
        assert_eq!(snippets[1].path, "a.md");
        assert_eq!(snippets[1].snippet.as_deref(), Some("Alpha"));
    }

    #[test]
    fn snippet_batch_keeps_other_results_when_a_file_is_missing() {
        let directory = tempdir().expect("temporary directory");
        let root_path = directory.path();
        fs::write(root_path.join("present.md"), "Present").expect("present note");

        let snippets = read_document_snippets(
            root_path.to_string_lossy().to_string(),
            vec!["missing.md".to_owned(), "present.md".to_owned()],
        )
        .expect("partial snippet batch");

        assert_eq!(snippets[0].snippet, None);
        assert_eq!(snippets[1].snippet.as_deref(), Some("Present"));
    }

    #[test]
    fn snippet_batch_rejects_unsafe_and_non_markdown_paths() {
        let directory = tempdir().expect("temporary directory");
        let root_path = directory.path();
        fs::write(root_path.join("note.txt"), "text").expect("text file");

        for path in ["/absolute.md", "../outside.md", ".hidden.md", "note.txt"] {
            assert!(
                read_document_snippets(
                    root_path.to_string_lossy().to_string(),
                    vec![path.to_owned()],
                )
                .is_err()
            );
        }

        #[cfg(unix)]
        {
            let outside = tempdir().expect("outside directory");
            fs::write(outside.path().join("outside.md"), "outside").expect("outside note");
            std::os::unix::fs::symlink(
                outside.path().join("outside.md"),
                root_path.join("linked.md"),
            )
            .expect("document symlink");
            assert!(
                read_document_snippets(
                    root_path.to_string_lossy().to_string(),
                    vec!["linked.md".to_owned()],
                )
                .is_err()
            );
        }
    }

    #[test]
    fn scan_ignores_hidden_entries_and_symlinks() {
        let directory = tempdir().expect("temporary directory");
        let root = directory.path();
        fs::create_dir(root.join("notes")).expect("notes directory");
        fs::write(root.join("root.md"), "root").expect("root note");
        fs::write(root.join("notes/intent.md"), "intent").expect("nested note");
        fs::write(root.join(".hidden.md"), "hidden").expect("hidden note");

        #[cfg(unix)]
        std::os::unix::fs::symlink(root.join("notes"), root.join("linked"))
            .expect("folder symlink");

        let snapshot =
            scan_library(root.to_string_lossy().to_string()).expect("library scan succeeds");

        assert_eq!(snapshot.documents.len(), 2);
        assert_eq!(snapshot.folders.len(), 1);
        assert!(
            snapshot
                .documents
                .iter()
                .all(|entry| !entry.path.starts_with('.'))
        );
        assert!(snapshot.folders.iter().all(|entry| entry.name != "linked"));
    }

    #[test]
    fn atomic_save_rejects_external_changes_without_overwriting() {
        let directory = tempdir().expect("temporary directory");
        let path = directory.path().join("intent.md");
        fs::write(&path, "original").expect("original file");
        let expected = super::modified_millis(&path).expect("mtime");
        thread::sleep(Duration::from_millis(5));
        fs::write(&path, "external").expect("external edit");

        let result = atomic_save(&path, "mine", Some(expected));

        assert!(result.is_err());
        assert_eq!(
            fs::read_to_string(&path).expect("preserved content"),
            "external"
        );
    }

    #[test]
    fn document_create_rename_and_move_preserve_content() {
        let directory = tempdir().expect("temporary directory");
        let root = directory.path().to_string_lossy().to_string();
        create_folder(root.clone(), "".to_owned(), "archive".to_owned()).expect("archive folder");
        let created = create_document(
            root.clone(),
            "".to_owned(),
            "의도".to_owned(),
            "first".to_owned(),
        )
        .expect("create document");
        let renamed = rename_document(
            root.clone(),
            created.path,
            "선택".to_owned(),
            "updated".to_owned(),
            created.mtime_ms,
        )
        .expect("rename document");
        let moved =
            move_entry(root.clone(), renamed.path, "archive".to_owned()).expect("move document");

        assert_eq!(moved.path, "archive/선택.md");
        assert_eq!(
            fs::read_to_string(directory.path().join(moved.path)).expect("moved document"),
            "updated"
        );
        assert!(!directory.path().join("의도.md").exists());
    }

    #[test]
    fn move_collision_keeps_both_original_entries() {
        let directory = tempdir().expect("temporary directory");
        let root_path = directory.path();
        let root = root_path.to_string_lossy().to_string();
        fs::create_dir(root_path.join("a")).expect("folder a");
        fs::create_dir(root_path.join("b")).expect("folder b");
        fs::write(root_path.join("a/note.md"), "source").expect("source note");
        fs::write(root_path.join("b/note.md"), "target").expect("target note");

        let failure = move_entry(root, "a/note.md".to_owned(), "b".to_owned())
            .expect_err("collision must fail");

        assert_eq!(failure.code, "collision");
        assert_eq!(
            fs::read_to_string(root_path.join("a/note.md")).expect("source preserved"),
            "source"
        );
        assert_eq!(
            fs::read_to_string(root_path.join("b/note.md")).expect("target preserved"),
            "target"
        );
    }
}
