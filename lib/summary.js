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

// getOutdatedReason reports a full batch as data added, since more batches are expected, and any
// other batch as the completed upload. A failed upload is completed whatever its size: the uploader
// stops at the rejected datum, so no batch follows.
function getOutdatedReason(data, uploadFailed) {
  data = Array.isArray(data) ? data : [data];
  const fullBatch = data.length > 0 && data.length % batchSize === 0;
  return fullBatch && !uploadFailed ? outdatedReasonDataAdded : outdatedReasonUploadCompleted;
}

// needsPostprocessing reports whether the datums an upload request stored change the data platform
// postprocesses. Upload records describe a data set and carry no data of their own, and the legacy
// uploader posts one alone before the batches of the data it describes.
function needsPostprocessing(stored) {
  return stored.some(datum => datum.type !== 'upload');
}

// If the upload session is considered completed this clears the buffer so that the work is
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
  needsPostprocessing,
};
