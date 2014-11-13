/** @jsx React.DOM */
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

var React = require('react');
var bows = require('bows');
var $ = require('jquery');
var purl = require('purl-parser');

var api = require('./services/api');
var syncTaskService = require('./services/synctask');

var Notification = require('./notification');
var UploadForm = require('./uploadform');

var config = require('./config');

// Styles
require('./style.less');

// For React developer tools
window.React = React;

var app = {
  log: bows('App'),
  api: api,
  syncTaskService: syncTaskService
};

var AppComponent = React.createClass({
  getInitialState: function() {
    return {
      isAuthenticated: app.api.isAuthenticated(),
      isSyncTaskInProgress: false,
      formNotification: null
    };
  },

  componentDidMount: function() {
    app.api.onAuthenticationChange = this.handleAuthenticationChange;
  },

  render: function() {
    var appNotification = this.renderAppNotification();
    var form = this.renderForm();
    var formNotification = this.renderFormNotification();

    /* jshint ignore:start */
    return (
      <div className="app-container-outer container-small-outer">
        <div className="container-small-inner">
          {appNotification}
          {form}
          {formNotification}
        </div>
      </div>
    );
    /* jshint ignore:end */
  },

  renderAppNotification: function() {
    var message;
    var type = 'error';

    if (!this.state.isAuthenticated) {
      message = [
        'Oops! Login failed.',
        'Did you make sure that you are logged into a Tidepool app,',
        'and that you opened this upload screen from that app?'
      ].join(' ');
    }
    else if (!this.isCompatibleBrowser()) {
      message = [
        'Uh-oh, it looks like your browser is not compatible',
        'with this upload form.',
        'Maybe try upgrading your browser?',
        'Or use the latest version of Chrome, we know it works there!'
      ].join(' ');
    }

    if (message) {
      /* jshint ignore:start */
      return (
        <div className="app-notification">
          <Notification type={type} message={message}/>
        </div>
      );
      /* jshint ignore:end */
    }

    return null;
  },

  renderForm: function() {
    /* jshint ignore:start */
    return (
      <UploadForm
        disabled={this.isDisabledForm()}
        submitButtonText={this.getFormSubmitButtonText()}
        onSubmit={this.handleFormSubmit}
        providers={this.getProviders()}
        ref="uploadForm"/>
    );
    /* jshint ignore:end */
  },

  getProviders: function() {
    return {
      diasend: purl().param('diasend') != null,
      carelink: true,
      dexcom: true,
      tconnect: purl().param('tconnect') != null
    };
  },

  renderFormNotification: function() {
    var notification = this.state.formNotification;

    if (notification) {
      /* jshint ignore:start */
      return (
        <div className="app-notification">
          <Notification
            type={notification.type}
            message={notification.message}/>
        </div>
      );
      /* jshint ignore:end */
    }

    return null;
  },

  isDisabledForm: function() {
    var notAuthenticated = !this.state.isAuthenticated;
    var notCompatibleBrowser = !this.isCompatibleBrowser();
    var syncTaskInProgress = this.state.isSyncTaskInProgress;
    return (notAuthenticated || notCompatibleBrowser || syncTaskInProgress);
  },

  isCompatibleBrowser: function() {
    return ('FormData' in window);
  },

  getFormSubmitButtonText: function() {
    text = 'Upload data';
    if (this.state.isSyncTaskInProgress) {
      text = 'Uploading...';
    }
    return text;
  },

  handleAuthenticationChange: function(isAuthenticated) {
    this.setState({isAuthenticated: isAuthenticated});
    if (!isAuthenticated) {
      $(window).scrollTop(0);
    }
  },

  handleFormSubmit: function(formValues, formData) {
    var self = this;

    if (this.state.isSyncTaskInProgress) {
      return;
    }

    this.resetStateBeforeFormSubmit();

    var validationError = this.validateFormValues(formValues);
    if (validationError) {
      this.handleFormValidationError(validationError);
      return;
    }

    this.submitFormData(formData);
  },

  resetStateBeforeFormSubmit: function() {
    this.setState({
      isSyncTaskInProgress: false,
      formNotification: null
    });
  },

  validateFormValues: function(formValues) {
    var validationError;

    var hasDiasendCredentials = (
      formValues.diasendUsername && formValues.diasendPassword
    );
    var hasCarelinkCredentials = (
      formValues.carelinkUsername && formValues.carelinkPassword
    );
    var hasTconnectCredentials = (
      formValues.tconnectUsername && formValues.tconnectPassword
    );
    var hasDexcomFile = formValues.dexcom || false;

    if (!(hasDiasendCredentials || hasCarelinkCredentials || hasTconnectCredentials || hasDexcomFile)) {
      validationError = [
        'Sorry, we can\'t process your data yet!',
        'Please provide Diasend credentials, CareLink credentials, ' +
        't:connect credentials, and/or a Dexcom csv file.'
      ].join(' ');
    }

    return validationError;
  },

  handleFormValidationError: function(validationError) {
    this.setState({
      formNotification: {
        type: 'error',
        message: validationError
      }
    });
  },

  submitFormData: function(formData) {
    var self = this;

    this.setState({
      isSyncTaskInProgress: true,
      formNotification: {
        type: 'info',
        message: [
          'We are processing your data.',
          'Thank you for being patient, this could take a couple minutes...'
        ].join(' ')
      }
    });

    app.api.tidepool.trackMetric('Upload Started');
    app.api.upload.postFormData(formData, function(err, syncTask) {
      if (err) {
        return self.handleFormPostError(err);
      }
      self.handleFormPostSuccess(syncTask);
    });
  },

  handleFormPostError: function(err) {
    app.api.tidepool.trackMetric('Upload Fail');
    this.setState({
      isSyncTaskInProgress: false,
      formNotification: {
        type: 'error',
        message: [
          'Uh oh, something went wrong while processing your data.',
          'Are you sure you gave us correct user name and password?',
          'If you keep experiencing problems, please contact us.',
          'Sorry about this!'
        ].join(' ')
      }
    });
  },

  handleFormPostSuccess: function(syncTask) {
    var self = this;
    var syncTaskId = syncTaskService.getTaskId(syncTask);

    if (!syncTaskId) {
      return self.handleFormPostError({message: 'No sync task id'});
    }

    this.waitForSyncTaskWithIdToFinish(syncTaskId, function(err, task) {
      if (err) {
        return self.handleFormPostError(err);
      }
      self.handleSyncTaskSuccess(task);
    });
  },

  waitForSyncTaskWithIdToFinish: function(syncTaskId, callback) {
    // Polling frequency, in milliseconds
    var pollingInterval = 3 * 1000;

    // When to give up, in milliseconds
    var pollingTimeout = 5 * 60 * 1000;
    var pollingTimedOut = false;

    setTimeout(function () {
      pollingTimedOut = true;
    }, pollingTimeout);

    // Start long-polling
    app.log('Starting sync task long polling with id', syncTaskId);
    (function poll(done) {
      setTimeout(function () {
        app.api.syncTask.get(syncTaskId, function(err, task) {
          if (err) {
            return done(err);
          }

          app.log('Sync task poll complete', task);

          if (syncTaskService.isFailed(task)) {
            return done({message: 'Sync task failed'});
          }

          if (syncTaskService.isSuccessful(task)) {
            return done(null, task);
          }

          poll(done);
        });
      }, pollingInterval);
    }(callback));
  },

  handleSyncTaskSuccess: function(syncTask) {
    app.api.tidepool.trackMetric('Upload Success');
    this.setState({
      isSyncTaskInProgress: false,
      formNotification: {
        type: 'success',
        message: [
          'Your data was successfully uploaded to Tidepool!',
          'It is now safe to close this window.'
        ].join(' ')
      }
    });
  }
});

app.start = function() {
  var self = this;

  this.init(function() {
    self.component = React.renderComponent(
      /* jshint ignore:start */
      <AppComponent />,
      /* jshint ignore:end */
      document.getElementById('app')
    );

    self.log('App started');
  });
};

app.init = function(callback) {
  this.api.init(callback);
};

module.exports = app;
