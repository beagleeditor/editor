{
  description = "BeagleEditor - Tauri Monaco Editor";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];

      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f (
            import nixpkgs {
              inherit system;
            }
          )
        );
    in
    {
      packages = forAllSystems (pkgs: {
        default = pkgs.stdenv.mkDerivation {
          pname = "beagleeditor";
          version = "26.2.1";

          src = ./.;

          nativeBuildInputs = with pkgs; [
            nodejs
            cargo
            rustc
            rustPlatform.cargoSetupHook
            pkg-config
          ];

          buildInputs = with pkgs; [
            webkitgtk_4_1
            gtk3
            libsoup_3
          ];

          buildPhase = ''
            npm install
            npm run build
            cargo build --release
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp src-tauri/target/release/beagleeditor $out/bin/
          '';
        };
      });
    };
}
