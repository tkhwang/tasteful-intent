mod library;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            library::resolve_document_source,
            library::resolve_library_root,
            library::print_document,
            library::scan_library,
            library::scan_docs_root,
            library::read_document,
            library::read_document_baseline,
            library::read_document_image,
            library::read_document_snippets,
            library::create_document,
            library::save_document,
            library::rename_document,
            library::create_folder,
            library::rename_folder,
            library::move_entry,
            library::trash_entry,
        ])
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|_app| {
            #[cfg(all(desktop, not(feature = "app-store")))]
            _app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
