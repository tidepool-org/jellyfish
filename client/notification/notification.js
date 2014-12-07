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

'use strict';

var React = require('react');

var Notification = React.createClass({
  propTypes: {
    type: React.PropTypes.string,
    message: React.PropTypes.string
  },

  getDefaultProps: function() {
    return {
      type: 'alert'
    };
  },
  
  render: function() {
    var className = this.getClassName();

    /* jshint ignore:start */
    return (
      <div className={className}>
        {this.props.message}
      </div>
    );
    /* jshint ignore:end */
  },

  getClassName: function() {
    var type = this.props.type;
    var className = [
      'notification',
      'notification-' + type
    ].join(' ');
    return className;
  }
});

module.exports = Notification;