// Manual Jest mock for the Supabase config module. The Supabase SDK is the one
// unavoidable external boundary in the auth flow, so every auth spec stubs it.
// Centralising the mock here (instead of re-declaring an inline factory in each
// spec) means a new SDK call only has to be added in one place. Specs opt in with
// a bare `jest.mock('../../config/supabase.config')` and reach for the jest.fn()s
// they need.
export const supabaseClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    verifyOtp: jest.fn(),
    refreshSession: jest.fn(),
  },
};

// A single shared bucket object so `from()` returns the same handle every call,
// which lets storage specs assert on `.upload` / `.getPublicUrl` / `.remove`.
const storageBucket = {
  upload: jest.fn(),
  getPublicUrl: jest.fn(),
  remove: jest.fn(),
};

export const supabaseAdmin = {
  auth: {
    getUser: jest.fn(),
    admin: {
      signOut: jest.fn(),
      updateUserById: jest.fn(),
    },
  },
  storage: {
    from: jest.fn(() => storageBucket),
  },
};
