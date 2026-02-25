#!/bin/bash
# fixfonts.sh

typeset folder="$1"
if [[ -d "$folder" && ! -z "$folder" ]]; then
  pushd "$folder";
  for file in *.ttf; do
    typeset normalized="${file//-/_}";
    normalized=$(echo "$normalized" | tr '[:upper:]' '[:lower:]');
    mv "$file" "$normalized"
  done
  popd
fi