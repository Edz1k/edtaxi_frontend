import type { SupportMessage, SupportRoom } from '../types/support'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupportStore } from '../stores/create-support-store'

const api = vi.hoisted(() => ({
  attachTripToSupport: vi.fn(),
  closeSupportRoom: vi.fn(),
  getSupportMessages: vi.fn(),
  getSupportRoom: vi.fn(),
  listSupportRooms: vi.fn(),
  openSupportRoom: vi.fn(),
  sendSupportMessage: vi.fn(),
  uploadSupportImage: vi.fn(),
}))
vi.mock('../api/support', () => api)
vi.mock('../api/errors', () => ({ showErrorToast: vi.fn(() => 'error') }))

const usePassengerSupportStore = createSupportStore('passenger')
const useDriverSupportStore = createSupportStore('driver')

function makeRoom(overrides: Partial<SupportRoom> = {}): SupportRoom {
  return {
    agent_id: null,
    agent_name: null,
    created_at: '',
    id: 'r1',
    participant_type: 'passenger',
    passenger_id: 'p1',
    status: 'open',
    subject: 'trip',
    updated_at: '',
    ...overrides,
  }
}

function makeMessage(overrides: Partial<SupportMessage> = {}): SupportMessage {
  return { content: 'hi', id: 'm1', image_url: null, sender_id: 's1', sent_at: '', ...overrides }
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.values(api).forEach(fn => fn.mockReset())
  api.getSupportMessages.mockResolvedValue({ messages: [], room_id: 'r1' })
})

describe('loadRooms', () => {
  it('loads rooms for the injected participant type', async () => {
    api.listSupportRooms.mockResolvedValue({ rooms: [makeRoom()] })
    const store = usePassengerSupportStore()

    const rooms = await store.loadRooms()

    expect(api.listSupportRooms).toHaveBeenCalledWith('passenger')
    expect(rooms).toHaveLength(1)
    expect(store.rooms).toHaveLength(1)
  })

  it('uses the driver participant type in the driver store', async () => {
    api.listSupportRooms.mockResolvedValue({ rooms: [] })
    const store = useDriverSupportStore()

    await store.loadRooms()

    expect(api.listSupportRooms).toHaveBeenCalledWith('driver')
  })
})

describe('sendMessage', () => {
  it('ignores blank content and does not hit the API', async () => {
    const store = usePassengerSupportStore()
    await store.selectRoom(makeRoom())

    await store.sendMessage('   ')

    expect(api.sendSupportMessage).not.toHaveBeenCalled()
  })

  it('ignores messages when no room is open', async () => {
    const store = usePassengerSupportStore()

    await store.sendMessage('hello')

    expect(api.sendSupportMessage).not.toHaveBeenCalled()
  })

  it('trims the content and appends the returned message', async () => {
    api.sendSupportMessage.mockResolvedValue(makeMessage({ id: 'm2', content: 'hello' }))
    const store = usePassengerSupportStore()
    await store.selectRoom(makeRoom({ id: 'r1' }))

    await store.sendMessage('  hello  ')

    expect(api.sendSupportMessage).toHaveBeenCalledWith('r1', { content: 'hello' })
    expect(store.messages.map(m => m.id)).toEqual(['m2'])
  })
})

describe('receiveMessage', () => {
  it('appends to the active room, applies the room status and dedupes', async () => {
    const store = usePassengerSupportStore()
    await store.selectRoom(makeRoom({ id: 'r1', status: 'open' }))

    store.receiveMessage({ ...makeMessage({ id: 'm1' }), room_id: 'r1', room_status: 'pending_close' })

    expect(store.messages.map(m => m.id)).toEqual(['m1'])
    expect(store.activeRoom?.status).toBe('pending_close')

    // Same id again → no duplicate.
    store.receiveMessage({ ...makeMessage({ id: 'm1' }), room_id: 'r1', room_status: 'pending_close' })
    expect(store.messages).toHaveLength(1)
  })

  it('ignores messages for a different room', async () => {
    const store = usePassengerSupportStore()
    await store.selectRoom(makeRoom({ id: 'r1' }))

    store.receiveMessage({ ...makeMessage({ id: 'm9' }), room_id: 'other', room_status: 'open' })

    expect(store.messages).toHaveLength(0)
  })
})

describe('closeRoom', () => {
  it('closes the active room and marks it closed in the list', async () => {
    api.listSupportRooms.mockResolvedValue({ rooms: [makeRoom({ id: 'r1', status: 'open' })] })
    api.closeSupportRoom.mockResolvedValue({ message: 'ok' })
    const store = usePassengerSupportStore()
    await store.loadRooms()
    await store.selectRoom(makeRoom({ id: 'r1', status: 'open' }))

    await store.closeRoom()

    expect(api.closeSupportRoom).toHaveBeenCalledWith('r1')
    expect(store.activeRoom?.status).toBe('closed')
    expect(store.rooms.find(r => r.id === 'r1')?.status).toBe('closed')
  })
})

describe('attachTrip', () => {
  it('opens a trip room for the participant and attaches the trip', async () => {
    api.openSupportRoom.mockResolvedValue(makeRoom({ id: 'r5', subject: 'trip' }))
    api.attachTripToSupport.mockResolvedValue({ message: 'ok' })
    const store = usePassengerSupportStore()

    const room = await store.attachTrip('trip-123')

    expect(api.openSupportRoom).toHaveBeenCalledWith({ participant_type: 'passenger', subject: 'trip' })
    expect(api.attachTripToSupport).toHaveBeenCalledWith('r5', 'trip-123')
    expect(room.id).toBe('r5')
  })
})

describe('clearSupportState', () => {
  it('resets rooms, active room and messages', async () => {
    api.listSupportRooms.mockResolvedValue({ rooms: [makeRoom()] })
    const store = usePassengerSupportStore()
    await store.loadRooms()
    expect(store.rooms).toHaveLength(1)

    store.clearSupportState()

    expect(store.rooms).toEqual([])
    expect(store.activeRoom).toBeNull()
    expect(store.messages).toEqual([])
  })
})
