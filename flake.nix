{
  description = "Ebb: auto-archive old tabs, a Chrome and Helium extension";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-linux"
        "x86_64-linux"
        "aarch64-darwin"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAll (pkgs: rec {
        ci = pkgs.mkShell {
          packages = [
            pkgs.bun
            pkgs.zip
          ];
        };
        # The browser test: Chromium, and a font so pages lay out and screenshots show text.
        e2e = pkgs.mkShell {
          packages = [
            pkgs.bun
            pkgs.chromium
          ];
          FONTCONFIG_FILE = pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; };
        };
        default = pkgs.mkShell {
          inputsFrom = [
            ci
            e2e
          ];
        };
      });
    };
}
