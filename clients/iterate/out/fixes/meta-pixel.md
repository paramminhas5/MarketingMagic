# Meta pixel + Conversions API for Iterate

1. Events Manager → create/choose the dataset (pixel) for Iterate. Copy the pixel ID.
2. Browser: add the base code once per page (Next.js: in _app or layout via next/script, strategy="afterInteractive").

```html
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>
```

3. Fire the real conversion where it happens, with an event_id you also send server-side:
   - Form submit: `fbq('track', 'Lead', {}, {eventID})`
4. Server: POST the same event to https://graph.facebook.com/v23.0/<PIXEL_ID>/events with access_token, the same event_id, hashed email/phone, client IP and user agent. Dedup happens on event_id.
5. Verify in Events Manager → Test events. Then set the campaign's optimisation event to this conversion.
