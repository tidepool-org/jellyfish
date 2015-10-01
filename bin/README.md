### `rawUploads.js`

The `rawUploads.js` script will list and download raw uploads for the specified user.

#### Setup

This script is executed via the command line. The command line environment must
be setup as if `jellyfish` were running.

To execute the script on the `devel`, `staging`, or `prod` environment:

1. In a terminal window, SSH into an app server within the environment.
1. Switch user to `tidepool-deploy`.

  ``` bash
sudo su - tidepool-deploy
  ```

1. Change directory to the latest `jellyfish` deploy.

  ``` bash
cd /mnt/shio/deploy/jellyfish-*/deploy
ls -al
cd <the-latest-deploy>/jellyfish*
  ```
1. Setup the environment.

  ``` bash
source config/env.sh
  ```

1. Execute the script following the instructions below. You may note a signficant
delay (up to 30 seconds) while executing the script. The script is discovering
the required services (`shoreline`, `seagull`).

To execute the script in a `local` environment:

1. In a terminal window, start all of the services as normal (eg. `. tools/runserver`).
1. Restart `jellyfish`. This temporarily sets up the command line environment correctly.

  ``` bash
tp_restart jellyfish
  ```

1. Change directory to the `jellyfish` directory.

  ``` bash
cd jellyfish
  ```

1. Execute the script following the instructions below.

#### Execution

There are two ways to execute the script:

1. To list all of the uploads for a given user (not the uploading user, but
the **target** user):

  `node bin/rawUploads.js list <user-id>`

  This will list all uploads for the specified user id. The first field will be
  the upload id and the second field will be the timestamp when the upload was
  initiated.

  To get a "clean" list without the logging statements, piping through grep works well:

  `node bin/rawUploads.js list <user-id> | grep -v '^{'`

2. To download to stdout a particular upload by id:

  `node bin/rawUploads.js download <upload-id>`

  The unencrypted upload will be piped to stdout.

  To get a "clean" CSV from stdout into a file without the logging statements,
  piping through grep works well:

  `node bin/rawUploads.js download <upload-id> | grep -v '^{' > /path/to/save/file/`

**Note: Yes, the logging statements are truly annoying. Unfortunately, there isn't
much that can be done about them without signficant effort.**
