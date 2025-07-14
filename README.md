`/Applications/Firefox.app/Contents/MacOS/firefox --profile "$(mktemp -d)"`
for a new profile

https://addons.mozilla.org/en-US/developers/addons
for the developer hub

`zip -r site-blocker.xpi *`
to create xpi file

After the addon gets approved, https://addons.mozilla.org/en-US/developers/addon/a34efc3fcce040e88a36/versions/5970005 click on the version and then download the file. This will install the new version.