export default function storage(state = {
  mode: 'LOCAL_STORAGE',
  status: 'GET',
  googleDrive: {}
}, action) {
  switch (action.type) {
    case 'NEW_GOOGLE_DRIVE_DIAGRAM': {
      return {
        ...state,
        mode: 'GOOGLE_DRIVE',
        status: 'POST',
        googleDrive: {
          ...state.googleDrive,
          fileId: null
        }
      }
    }
    case 'NEW_LOCAL_STORAGE_DIAGRAM': {
      return {
        ...state,
        mode: 'LOCAL_STORAGE',
        status: 'POST'
      }
    }
    case 'PICK_DIAGRAM': {
      return {
        ...state,
        status: 'PICKING_FROM_GOOGLE_DRIVE',
      }
    }
    case 'PICK_DIAGRAM_CANCEL': {
      return {
        ...state,
        status: 'READY',
      }
    }
    case 'GET_FILE_FROM_GOOGLE_DRIVE': {
      return {
        mode: 'GOOGLE_DRIVE',
        status: 'GET',
        googleDrive: {
          ...state.googleDrive,
          fileId: action.fileId
        }
      }
    }
    case 'FETCHING_GRAPH': {
      return {
        ...state,
        status: 'GETTING'
      }
    }
    case 'STORE_CURRENT_DIAGRAM_AS_NEW_FILE_ON_GOOGLE_DRIVE': {
      return {
        mode: 'GOOGLE_DRIVE',
        status: 'POST',
        googleDrive: {
          ...state.googleDrive,
          fileId: null
        }
      }
    }
    case 'FETCHING_GRAPH_SUCCEEDED': {
      return {
        ...state,
        status: 'READY'
      }
    }
    case 'CREATED_FILE_ON_GOOGLE_DRIVE':
      return {
        ...state,
        status: 'READY',
        googleDrive: {
          ...state.googleDrive,
          fileId: action.fileId
        }
      }
    case 'GOOGLE_DRIVE_SIGN_IN_STATUS':
      return {
        ...state,
        googleDrive: {
          ...state.googleDrive,
          apiInitialized: true,
          signedIn: action.signedIn
        }
      }

    default:
      return state
  }
}
