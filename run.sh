#!/bin/sh

pip install -r requirements.txt

mkdir /root/.ssh

echo "Host github.com" >> /root/.ssh/config
echo "HostName github.com" >> /root/.ssh/config
echo "IdentityFile /root/.ssh/deploy-key" >> /root/.ssh/config
echo "User git" >> /root/.ssh/config

python taskcluster_get_secret.py ssh_key > /root/.ssh/deploy-key
chmod u=rw,og= /root/.ssh/deploy-key

python taskcluster_get_secret.py github_ssh_host  > /root/.ssh/known_hosts

git remote set-url origin git@github.com:mozilla/stab-crashes.git
git fetch origin -f gh-pages:gh-pages

echo "[User-Agent]" >> mozdata.ini
echo "name=stab-crashes" >> mozdata.ini

export BUGZILLA_TOKEN=$(python taskcluster_get_secret.py BUGZILLA_TOKEN)
python generate-data.py

ghp-import -n -p -m "Updates" dist
