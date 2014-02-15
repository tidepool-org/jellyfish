/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 * 
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

(function () {
  var dexcomFileName = '';
  var dexcomFileUrl = '';

  var isFilledIn = function () {
    var somethingFilledIn = false;
    somethingFilledIn = ($('#carelinkUsername').val() && $('#carelinkPassword').val()) || somethingFilledIn;
    somethingFilledIn = ($('#diasendUsername').val() && $('#diasendPassword').val()) || somethingFilledIn;
    return somethingFilledIn;
  }

  this.dexcomFileName = '';
  this.dexcomFileUrl = '';


  function render(groupId, tab, callback) {
    var self = this;
    self.groupId = groupId;

    var info;
    if (tab) {
      info = {cleanUrl: app.config.apiEndpoint + '/v1/' + data.user.id + '/cleanallthedata?accessToken=' + app.auth.token};
    }
    else {
      info = data.profile;
    }

    var html = self.template(info);

    var el = $('#data-upload-ftw-gangnam-style-bbqsauce')
    el.show();
    el.html(html);
    el.find('.go').addClass('disabled');
    el.find('#profile-setup-device-picker').fadeIn();
    el.find('#upload-animas h2').click(self.animas);
    el.find('#upload-medtronic h2').click(self.medtronic);
    el.find('#upload-dexcom h2').click(self.dexcom);
    el.find('input').on('change keydown paste input', self.ready);

    el.find('#uploadButton').click(function (e) {
      if (e) {
        e.preventDefault();
      }

      if (app.config.mock) {
        return alert('Not available in "mock" mode.');
      }

      if (!isFilledIn()) {
        return;
      }

      var uploadData = self.getUploadData();

      app.view.overlay.wait('Uploading and syncing data');

      // Create new sync task
      app.api.group.postDeviceData(groupId, uploadData, function (error, syncTask) {
        var syncTaskId = syncTask._id,
        // Polling frequency, in milliseconds
          pollingInterval = 3 * 1000,
        // When to give up, in milliseconds
          pollingTimeout = 5 * 60 * 1000,
          pollingTimedOut = false;

        setTimeout(function () {
          pollingTimedOut = true;
        }, pollingTimeout);

        // Start long-polling sync task status
        (function poll(done) {
          setTimeout(function () {
            app.api.syncTask.get(syncTaskId, function (err, syncTask) {
              if (err || syncTask.status === 'error') {
                return done('An error occured while syncing data');
              }

              if (pollingTimedOut) {
                return done('Data sync timed out');
              }

              if (syncTask.status === 'success') {
                return done(null, syncTask);
              }

              // Call polling function recursively
              poll(done);
            });
          }, pollingInterval);
        }(onSyncTaskFinished));

        function onSyncTaskFinished(err, syncTask) {
          if (err) {
            alert(err.toString());
            app.view.overlay.white();
            return;
          }

          // We are done with Ink, make sure we don't try to remove file
          // that's just been synced, in case user tries to upload again
          self.inkBlob = undefined;

          app.view.overlay.wait('Data sync complete');
          // Give some time to see "complete" message
          setTimeout(function () {
            app.router.navigate('group/' + groupId, {trigger: true});
          }, 1000);
        }
      });
    });

    callback();
  }

  function animas() {
    $('#upload-animas .device-import').slideToggle();
  }

  function dexcom() {
    $('#upload-dexcom .device-import').slideToggle();
  }

  function medtronic() {
    $('#upload-medtronic .device-import').slideToggle();
  }

  function chooseDexcomFile(e) {
  }

  function updateDexcomFile(filename, url) {
    this.dexcomFileName = filename;
    this.dexcomFileUrl = url;
    this.$('.js-dexcom-file').text(this.dexcomFileName);
    this.$('.js-dexcom-remove').show();
  }

  function removeDexcomFile(e) {
    if (e) {
      e.preventDefault();
    }
    this.removeCurrentInkBlob();
    this.dexcomFileName = '';
    this.dexcomFileUrl = '';
    this.$('.js-dexcom-file').text('No file chosen');
    this.$('.js-dexcom-remove').hide();
  }

  function getUploadData() {
    var uploadData = this.getFormData();
    uploadData.userId = data.user ? data.user.id : '';
    uploadData.timezoneOffset = data.group.timezone;
    uploadData.daysAgo = 180;
    return uploadData;
  }

  function getFormData() {
    return  {
      diasendUsername: $('#diasendUsername').val(),
      diasendPassword: $('#diasendPassword').val(),
      dexcomFileName: this.dexcomFileName,
      dexcomFileUrl: this.dexcomFileUrl,
      carelinkUsername: $('#carelinkUsername').val(),
      carelinkPassword: $('#carelinkPassword').val()
    };
  }

})();