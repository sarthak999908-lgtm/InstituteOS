const API_URL = "http://localhost:5000/api";

export async function getDashboard() {
  const response = await fetch(`${API_URL}/dashboard`);

  if (!response.ok) {
    throw new Error(`Dashboard request failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error("Invalid dashboard API response");
  }

  return result.data;
}