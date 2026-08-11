import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import type {
  DocsDocumentRef,
  DocumentPayload,
  DocumentSnippet,
  EntryMutation,
  LibrarySnapshot,
} from "@/types/library";

const folderEntrySchema = z.object({
  path: z.string(),
  parent: z.string(),
  name: z.string(),
});

const documentEntrySchema = z.object({
  path: z.string(),
  parent: z.string(),
  title: z.string(),
  updatedMs: z.number().nonnegative(),
});

const librarySnapshotSchema = z.object({
  folders: z.array(folderEntrySchema),
  documents: z.array(documentEntrySchema),
});

const documentPayloadSchema = z.object({
  path: z.string(),
  content: z.string(),
  mtimeMs: z.number().nonnegative(),
});

const documentSnippetSchema = z.object({
  path: z.string(),
  snippet: z.string().nullable(),
});

const documentSnippetsSchema = z.array(documentSnippetSchema);
const documentImageSchema = z.object({
  bytes: z.array(z.number().int().min(0).max(255)),
  mimeType: z.string().startsWith("image/"),
});

const entryMutationSchema = z.object({ path: z.string() });
const commandErrorSchema = z.object({ code: z.string(), message: z.string() });
const documentSourceSchema = z.object({
  root: z.string().min(1),
  path: z.string().min(1),
});

export class NativeCommandError extends Error {
  readonly name = "NativeCommandError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function printDocument(): Promise<void> {
  try {
    await invoke("print_document");
  } catch (cause) {
    throw normalizeNativeError(cause);
  }
}

export async function scanLibrary(root: string): Promise<LibrarySnapshot> {
  return await invokeParsed("scan_library", { root }, librarySnapshotSchema);
}

export async function resolveDocumentSource(
  path: string,
): Promise<DocsDocumentRef> {
  return await invokeParsed(
    "resolve_document_source",
    { path },
    documentSourceSchema,
  );
}

export async function readDocument(
  root: string,
  path: string,
): Promise<DocumentPayload> {
  return await invokeParsed(
    "read_document",
    { root, path },
    documentPayloadSchema,
  );
}

export async function readDocumentImage(
  root: string,
  documentPath: string,
  source: string,
): Promise<{ readonly bytes: readonly number[]; readonly mimeType: string }> {
  return await invokeParsed(
    "read_document_image",
    { root, documentPath, source },
    documentImageSchema,
  );
}

export async function readDocumentSnippets(
  root: string,
  paths: readonly string[],
): Promise<readonly DocumentSnippet[]> {
  return await invokeParsed(
    "read_document_snippets",
    { root, paths },
    documentSnippetsSchema,
  );
}

export async function createDocument(
  root: string,
  parent: string,
  title: string,
  content: string,
): Promise<DocumentPayload> {
  return await invokeParsed(
    "create_document",
    { root, parent, title, content },
    documentPayloadSchema,
  );
}

export async function saveDocument(
  root: string,
  path: string,
  content: string,
  expectedMtimeMs: number,
): Promise<DocumentPayload> {
  return await invokeParsed(
    "save_document",
    { root, path, content, expectedMtimeMs },
    documentPayloadSchema,
  );
}

export async function renameDocument(
  root: string,
  path: string,
  title: string,
  content: string,
  expectedMtimeMs: number,
): Promise<DocumentPayload> {
  return await invokeParsed(
    "rename_document",
    { root, path, title, content, expectedMtimeMs },
    documentPayloadSchema,
  );
}

export async function createFolder(
  root: string,
  parent: string,
  name: string,
): Promise<EntryMutation> {
  return await invokeParsed(
    "create_folder",
    { root, parent, name },
    entryMutationSchema,
  );
}

export async function renameFolder(
  root: string,
  path: string,
  name: string,
): Promise<EntryMutation> {
  return await invokeParsed(
    "rename_folder",
    { root, path, name },
    entryMutationSchema,
  );
}

export async function moveEntry(
  root: string,
  path: string,
  destination: string,
): Promise<EntryMutation> {
  return await invokeParsed(
    "move_entry",
    { root, path, destination },
    entryMutationSchema,
  );
}

export async function trashEntry(root: string, path: string): Promise<void> {
  try {
    await invoke("trash_entry", { root, path });
  } catch (cause) {
    throw normalizeNativeError(cause);
  }
}

async function invokeParsed<T>(
  command: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const result = await invoke<unknown>(command, args);
    return schema.parse(result);
  } catch (cause) {
    if (cause instanceof z.ZodError) {
      throw new NativeCommandError(
        "invalid-response",
        `Native response did not match its contract: ${cause.message}`,
      );
    }
    throw normalizeNativeError(cause);
  }
}

function normalizeNativeError(cause: unknown): NativeCommandError {
  if (cause instanceof NativeCommandError) return cause;
  const parsed = commandErrorSchema.safeParse(cause);
  if (parsed.success) {
    return new NativeCommandError(parsed.data.code, parsed.data.message);
  }
  if (cause instanceof Error) {
    return new NativeCommandError("native-error", cause.message);
  }
  if (typeof cause === "string") {
    return new NativeCommandError("native-error", cause);
  }
  return new NativeCommandError(
    "native-error",
    "Unknown native command failure",
  );
}
