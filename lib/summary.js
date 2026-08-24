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

// Upload Batch Size
const batchSize = 1000;

// Platform postprocess work reasons. LEGACY_DATA_ADDED reports a full batch, which platform may
// defer, as more batches of the same upload are expected; a completed upload reports
// UPLOAD_COMPLETED, the same reason platform reports when a data set is closed.
const outdatedReasonDataAdded = 'LEGACY_DATA_ADDED';
const outdatedReasonUploadCompleted = 'UPLOAD_COMPLETED';

// If uploading an incomplete batch consider the upload session as completed for the purposes of summary recalculation
function getOutdatedReason(data) {
  data = Array.isArray(data) ? data : [data];
  return data.length % batchSize === 0 ? outdatedReasonDataAdded : outdatedReasonUploadCompleted;
}

// If the upload session is considered completed this clear the buffer so that the work is
// processed almost immediately.
//
// If we are expecting more batches, the work is deferred by at least 90s, and each subsequent
// batch reports a new deferral that platform absorbs into the waiting work — the upload is
// processed once, after it falls quiet. The buffer must be more than the maximum allowed request
// timeout (currently set to 60s).
function getOutdatedBuffer(reason) {
  return reason === outdatedReasonUploadCompleted ? 0 : 90*1000;
}

module.exports = {
  getOutdatedBuffer,
  getOutdatedReason,
};
