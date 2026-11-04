import {getAuthToken, recoverAuthSession} from "../hooks/useAuth.js";

const withCurrentToken = (options = {}) => {
  const token = getAuthToken();
  const headers = options.headers instanceof Headers
    ? new Headers(options.headers)
    : {...(options.headers || {})};
  if (headers instanceof Headers) {
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
  } else if (token) {
    headers.Authorization = `Bearer ${token}`;
  } else {
    delete headers.Authorization;
  }
  return {...options, headers};
};

export async function authenticatedFetch(input, options = {}) {
  const response = await fetch(input, withCurrentToken(options));
  if (response.status !== 401) return response;

  try {
    await recoverAuthSession();
  } catch {
    return response;
  }

  return fetch(input, withCurrentToken(options));
}
