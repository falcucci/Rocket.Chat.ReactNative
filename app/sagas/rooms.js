import {
	put, takeLatest, select
} from 'redux-saga/effects';

import * as types from '../actions/actionsTypes';
import { roomsSuccess, roomsFailure } from '../actions/rooms';
import database from '../lib/realm';
import log from '../utils/log';
import mergeSubscriptionsRooms from '../lib/methods/helpers/mergeSubscriptionsRooms';
import RocketChat from '../lib/rocketchat';

const handleRoomsRequest = function* handleRoomsRequest() {
	try {
		const newRoomsUpdatedAt = new Date();
		const server = yield select(state => state.server.server);
		const [serverRecord] = database.databases.serversDB.objects('servers').filtered('id = $0', server);
		const { roomsUpdatedAt } = serverRecord;
		const [subscriptionsResult, roomsResult] = yield RocketChat.getRooms(roomsUpdatedAt);
		const { subscriptions } = mergeSubscriptionsRooms(subscriptionsResult, roomsResult);

		database.write(() => {
			subscriptions.forEach((subscription) => {
				try {
					database.create('subscriptions', subscription, true);
				} catch (error) {
					log('err_rooms_request_create_sub', error);
				}
			});
		});
		database.databases.serversDB.write(() => {
			try {
				database.databases.serversDB.create('servers', { id: server, roomsUpdatedAt: newRoomsUpdatedAt }, true);
			} catch (e) {
				log('err_rooms_request_update', e);
			}
		});

		yield put(roomsSuccess());
	} catch (e) {
		yield put(roomsFailure(e));
		log('err_rooms_request', e);
	}
};

const root = function* root() {
	yield takeLatest(types.ROOMS.REQUEST, handleRoomsRequest);
};
export default root;
