(function () {
  var params = new URLSearchParams(window.location.search);
  if (params.get('adminPreview') !== '1') return;

  if (params.get('mode') === 'guest') {
    try { localStorage.removeItem('ju_auth'); } catch (error) {}
    return;
  }

  var email = (params.get('previewEmail') || 'student.preview@ju.edu.jo').trim();
  var localPart = email.split('@')[0] || 'Preview Member';
  var displayName = localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(function (part) { return part.charAt(0).toUpperCase() + part.slice(1); })
    .join(' ') || 'Preview Member';
  var initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(function (part) { return part.charAt(0); })
    .join('')
    .toUpperCase() || 'JU';
  var previewAccount = {
    name: displayName,
    username: localPart,
    rating: 1200,
    email: email,
    via: 'Admin preview'
  };

  try { localStorage.setItem('ju_auth', JSON.stringify(previewAccount)); } catch (error) {}

  function styleMemberLink(link) {
    link.textContent = initials;
    link.href = 'Profile.dc.html';
    link.title = displayName + ' · ' + email;
    link.setAttribute('aria-label', displayName);
    link.style.width = '38px';
    link.style.height = '38px';
    link.style.borderRadius = '50%';
    link.style.display = 'flex';
    link.style.alignItems = 'center';
    link.style.justifyContent = 'center';
    link.style.padding = '0';
    link.style.background = '#7A2431';
    link.style.color = '#F5EFE3';
    link.style.fontFamily = "'Cormorant Garamond', Georgia, serif";
    link.style.fontSize = '15px';
    link.style.fontWeight = '700';
    link.style.textDecoration = 'none';
  }

  function applyPreviewSession() {
    if (window.JU && window.JU.auth) window.JU.auth.set(previewAccount);

    document.querySelectorAll('sc-if').forEach(function (node) {
      var value = node.getAttribute('value') || '';
      if (value.indexOf('signedOut') !== -1) {
        node.style.display = 'none';
        return;
      }

      if (value.indexOf('signedIn') !== -1) {
        node.style.display = 'contents';
        node.querySelectorAll('a').forEach(styleMemberLink);
      }
    });

    document.querySelectorAll('a[href*="Sign In"], a[href*="Sign%20In"], a.sign-in').forEach(function (link) {
      if (/sign\s*in/i.test(link.textContent || '')) styleMemberLink(link);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPreviewSession);
  } else {
    applyPreviewSession();
  }
})();
