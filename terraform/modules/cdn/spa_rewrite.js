// Chỉ gắn ở behavior mặc định (S3) nên không đụng tới /api/* và /auth/*.
// /login, /exam/42 -> /index.html; /assets/app.3f2a.js giữ nguyên.
function handler(event) {
  var request = event.request;
  var lastSegment = request.uri.split('/').pop();
  if (lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}
