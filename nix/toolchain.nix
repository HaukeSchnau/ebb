# `sdk` is the projects-sdk source: the flake's input.
{ pkgs, sdk }: import "${sdk}/lib/toolchain.nix" { inherit pkgs; } // { inherit (pkgs) bun; }
