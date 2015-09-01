`rawUploads.js`

The `rawUploads.js` script will list and download raw uploads for a given user.

_Note: This script requires the environment be setup as if Jellyfish were
running._

There are two ways to use this script:

1. To list all of the uploads for a given user (not the uploading user, but
the target user):

  `node bin/rawUploads.js list <user-id>`

  This will list all uploads for the specified user id. The first field will be
  the upload id and the second field will be the timestamp when the upload was
  initiated.

2. To download to stdout a particular upload by id:

  `node bin/rawUploads.js download <upload-id>`

  The unencrypted upload will be piped to stdout.

  To get a "pure" CSV from stdout into a file, piping through grep works well:

  `node bin/rawUploads.js download <upload-id> | grep -v '^{' > /path/to/save/file/`
