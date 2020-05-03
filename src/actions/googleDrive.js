import config from "../config";
import {googleDriveSignInStatusChanged, updateGoogleDriveFileId, useGoogleDriveStorage} from "./storage";
import {renderPngForThumbnail} from "../graphics/utils/offScreenCanvasRenderer";
import {fetchGraphFromDrive} from "../storage/googleDriveStorage";
import {indexableText} from "../model/Graph";
import { getPresentGraph } from "../selectors"
export const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
export const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/drive.install';

export const initGoogleDriveApi = (store) => {
  const initClient = () => {
    window.gapi.client.init({
      apiKey: config.apiKey,
      clientId: config.clientId,
      discoveryDocs: DISCOVERY_DOCS,
      scope: SCOPES
    }).then(() => {
      // Listen for sign-in state changes.
      window.gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignedInStatus);

      // Handle the initial sign-in state.
      updateSignedInStatus(window.gapi.auth2.getAuthInstance().isSignedIn.get());
    })
  }

  const updateSignedInStatus = (signedIn) => {
    store.dispatch(googleDriveSignInStatusChanged(signedIn))
    if (signedIn) {
      const state = store.getState()
      const graph = getPresentGraph(state)

      if (state.storage.mode === 'GOOGLE_DRIVE') {
        const fileId = state.storage.googleDrive.fileId;
        if (fileId) {
          store.dispatch(fetchGraphFromDrive(fileId))
        } else {
          saveFile(graph, null, state.diagramName, onFileSaved)
        }
      }
    }
  }

  const onFileSaved = (fileId) => {
    store.dispatch(updateGoogleDriveFileId(fileId))
  }

  if (window.gapi) {
    window.gapi.load("client:auth2:picker", initClient)
  }
}

export const initializeGoogleDriveStorage = () => {
  return function (dispatch, getState) {
    dispatch(useGoogleDriveStorage())
    const state = getState()
    const graph = getPresentGraph(state)
    if (state.storage.googleDrive.signedIn) {
      const onFileSaved = (fileId) => {
        dispatch(updateGoogleDriveFileId(fileId))
      }
      saveFile({ graph, gangs: state.gangs }, null, state.diagramName, onFileSaved)
    } else {
      window.gapi.auth2.getAuthInstance().signIn();
    }
  }
}

export const renameGoogleDriveStore = (fileId, userFileName) => {
  window.gapi.client.drive.files.update({
    "fileId": fileId,
    "resource": {
      "name": userFileName
    }
  })
    .then(function(response) {
        // Handle the results here (response.result has the parsed body).
        console.log("Response", response);
      },
      function(err) { console.error("Execute error", err); });
}

const base64urlEncodeDataUrl = (dataUrl) => {
  return dataUrl.substring('data:image/png;base64,'.length).replace(/\+/g, '-').replace(/\//g, '_')
}

export const saveFile = (data, fileId, fileName, onFileSaved) => {
  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const close_delim = "\r\n--" + boundary + "--";

  const graph = data.graph

  const contentType = 'application/vnd.neo4j.arrows+json';

  const metadata = {
    'name': `${fileName}`,
    'mimeType': contentType,
    'contentHints': {
      'thumbnail': {
        'image': base64urlEncodeDataUrl(renderPngForThumbnail(graph).dataUrl),
        'mimeType': 'image/png'
      },
      'indexableText': indexableText(graph)
    }
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + contentType + '\r\n\r\n' +
    JSON.stringify(data) +
    close_delim;

  const request = window.gapi.client.request({
    'path': `/upload/drive/v3/files${fileId ? '/' + fileId : ''}`,
    'method': fileId ? 'PATCH' : 'POST',
    'params': {'uploadType': 'multipart'},
    'headers': {
      'Content-Type': 'multipart/related; boundary="' + boundary + '"'
    },
    'body': multipartRequestBody
  });

  request.execute((file) => {
    if (file.error) {
      console.log(file)
    } else {
      onFileSaved(file.id)
    }
  });

}