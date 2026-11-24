{
  description = "Ebb: auto-archive old tabs, a Chrome and Helium extension";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    nix-infra-modules = {
      url = "github:HaukeSchnau/nix-infra-modules/b365d13637b9dc83c397df542b5112a50ac8cbb9";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    { nixpkgs, nix-infra-modules, ... }:
    let
      systems = [
        "aarch64-linux"
        "x86_64-linux"
        "aarch64-darwin"
      ];
      forAll = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
      toolchain =
        pkgs:
        builtins.attrValues (
          import ./nix/toolchain.nix {
            inherit pkgs;
            sdk = nix-infra-modules;
          }
        );
    in
    {
      devShells = forAll (pkgs: rec {
        ci = pkgs.mkShell {
          packages = toolchain pkgs ++ [ pkgs.zip ];
        };
        # The browser test: Chromium, and a font so pages lay out and screenshots show text.
        e2e = pkgs.mkShell {
          packages = toolchain pkgs ++ [ pkgs.chromium ];
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
