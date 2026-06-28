pub mod fs;
pub mod search;

use tauri::{
    Emitter, menu::{Menu, MenuItem, Submenu}
};

use fs::{path_exists, read_dir, read_file, read_workspace, write_file, create_file, create_dir, delete_path, rename_path, reveal_in_finder, start_watch};
use search::search_workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // FILE MENU
            let open = MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?;
            let openFolder = MenuItem::with_id(app, "openfolder", "Open Folder...", true, Some("CmdOrCtrl+Shift+O"))?;
            let save = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;
            let quit =
                MenuItem::with_id(app, "quit", "Quit BeagleEditor", true, Some("CmdOrCtrl+Q"))?;

            let file_menu = Submenu::with_items(app, "File", true, &[&open, &openFolder, &save, &quit])?;

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
            },
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
