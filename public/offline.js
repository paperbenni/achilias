const status = document.getElementById("status");
function connectionStatus() {
  status.textContent = navigator.onLine
    ? "Your device has a connection. Try again to reach Achilias."
    : "Your device is offline.";
}
document.getElementById("retry").addEventListener("click", () => location.reload());
window.addEventListener("online", connectionStatus);
window.addEventListener("offline", connectionStatus);
connectionStatus();
