export default {
  fetch(request) {
    const destination=new URL(request.url);
    destination.protocol='https:';
    destination.host='www.kidshit.space';
    return Response.redirect(destination.href,301);
  }
};
