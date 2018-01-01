import {Graph} from "../model/Graph";
import {FETCHING_GRAPH_SUCCEEDED} from "./storageStatus";

const graph = (state = new Graph(), action) => {
  switch (action.type) {
    case 'CREATE_NODE':
      return state.createNode();

    case FETCHING_GRAPH_SUCCEEDED:
      return action.storedGraph

    default:
      return state
  }
}

export default graph