pub mod fs;
pub mod lsp;
pub mod search;

use tauri::{
    menu::{Menu, MenuItem, Submenu},
    Emitter,
};

use fs::{
    create_dir, create_file, delete_path, path_exists, read_dir, read_file, read_workspace,
    rename_path, reveal_in_finder, start_watch, write_file,
};
use lsp::{
    lsp_change, lsp_completion, lsp_definition, lsp_hover, lsp_is_initialized, lsp_open, lsp_save,
    lsp_format, lsp_signature_help, lsp_start, lsp_stop,
};
use search::search_workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // FILE MENU
            let open = MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?;
            let openfolder = MenuItem::with_id(
                app,
                "openfolder",
                "Open Folder...",
                true,
                Some("CmdOrCtrl+Shift+O"),
            )?;
            let save = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;
            let quit =
                MenuItem::with_id(app, "quit", "Quit BeagleEditor", true, Some("CmdOrCtrl+Q"))?;

            let file_menu =
                Submenu::with_items(app, "File", true, &[&open, &openfolder, &save, &quit])?;

            // APP INFO MENU (works everywhere, macOS just relocates it visually)
            let about = MenuItem::with_id(app, "about", "About BeagleEditor", true, None::<&str>)?;

            let settings =
                MenuItem::with_id(app, "settings", "Settings", true, Some("CmdOrCtrl+,"))?;

            let app_menu = Submenu::with_items(app, "BeagleEditor", true, &[&about, &settings])?;

            let help_menu = Submenu::with_items(app, "Help", true, &[&about])?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &help_menu])?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                println!("EMIT OPEN");
                let _ = app.emit("menu-open", ());
            }
            "openfolder" => {
                println!("EMIT OPEN FOLDER");
                let _ = app.emit("menu-open-folder", ());
            }
            "save" => {
                println!("EMIT SAVE");
                let _ = app.emit("menu-save", ());
            }
            "quit" => {
                app.exit(0);
            }
            "about" => {
                println!("EMIT ABOUT");
                let _ = app.emit("menu-about", ());
            }
            "settings" => {
                println!("EMIT SETTINGS");
                let _ = app.emit("menu-settings", ());
            }
            _ => {}
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_dir,
            read_file,
            write_file,
            read_workspace,
            path_exists,
            search_workspace,
            create_file,
            create_dir,
            delete_path,
            rename_path,
            reveal_in_finder,
            start_watch,
            lsp_start,
            lsp_stop,
            lsp_open,
            lsp_change,
            lsp_save,
            lsp_format,
            lsp_completion,
            lsp_is_initialized,
            lsp_hover,
            lsp_definition,
            lsp_signature_help,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
