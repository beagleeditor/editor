pub mod fs;
pub mod search;

use tauri::{
    menu::{Menu, Submenu, MenuItem},
    Emitter,
};

use fs::{read_dir, read_file, write_file, read_workspace, path_exists};
use search::{search_workspace};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // FILE MENU
            let open = MenuItem::with_id(app, "open", "Open...", true, Some("CmdOrCtrl+O"))?;
            let save = MenuItem::with_id(app, "save", "Save", true, Some("CmdOrCtrl+S"))?;
            let quit = MenuItem::with_id(app, "quit", "Quit BeagleEditor", true, Some("CmdOrCtrl+Q"))?;

            let file_menu = Submenu::with_items(
                app,
                "File",
                true,
                &[&open, &save, &quit],
            )?;

            // APP INFO MENU (works everywhere, macOS just relocates it visually)
            let about = MenuItem::with_id(app, "about", "About BeagleEditor", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;

            let app_menu = Submenu::with_items(
                app,
                "BeagleEditor",
                true,
                &[&about, &settings],
            )?;

            let menu = Menu::with_items(app, &[&app_menu, &file_menu])?;

            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "open" => {
                    println!("EMIT OPEN");
                    let _ = app.emit("menu-open", ());
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
            }
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
