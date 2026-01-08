#!/bin/bash

# Check if the current directory is the expected one and if the remote origin URL matches
CURRNENT_DIR=$(basename "$(pwd)")
GIT_REMOTE_ORIGIN_URL=$(git config --get remote.origin.url)
if [ "${CURRNENT_DIR}" == "role-playing-game-build-with-phaser" ]; then
    echo "Origin URL: ${GIT_REMOTE_ORIGIN_URL}"
    exit 0
fi
if [ "$GIT_REMOTE_ORIGIN_URL" == "https://github.com/CHUBU-TELECOMMUNICATIONS-CO-INC/role-playing-game-build-with-phaser.git" ]; then
    git remote remove origin
fi

if git remote get-url upstream > /dev/null ; then
    echo "Upstream remote already exists."
else
    git remote add upstream https://github.com/CHUBU-TELECOMMUNICATIONS-CO-INC/role-playing-game-build-with-phaser.git
fi
git fetch upstream
git merge upstream/main

sed -i -E 's/^src\/senario\.ts$/src\/senario.sample.ts/' .gitignore
