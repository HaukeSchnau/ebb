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
        default = ci;
      });
    };
}
