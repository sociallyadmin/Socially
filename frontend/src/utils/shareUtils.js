export const sharePost = async (post, apiBase, baseUrl = 'https://sociallyapp.org') => {
  if (!post || !post.id) {
    console.error('Invalid post object for sharing:', post);
    return { success: false, shared: false, error: 'Invalid post object' };
  }

  const shareUrl = `${baseUrl}/post/${post.id}`;
  const shareText = `Check out this post by ${post.author || 'someone'}: ${post.content?.substring(0, 100) || 'A post on Socially'}`;
  
  const shareData = {
    title: 'Socially',
    text: shareText,
    url: shareUrl
  };

  console.log('Attempting to share with data:', shareData);

  try {
    if (typeof navigator === 'undefined') {
      throw new Error('Navigator object not available');
    }

    if (typeof navigator.share === 'function') {
      if (typeof navigator.canShare === 'function') {
        if (!navigator.canShare(shareData)) {
          console.warn('Share data not supported by canShare, attempting anyway');
        }
      }
      
      try {
        await navigator.share(shareData);
        console.log('Post shared successfully via Web Share API');
        return { success: true, shared: true };
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') {
          console.log('Share dialog cancelled by user');
          return { success: true, shared: false, aborted: true };
        }
        throw shareErr;
      }
    } else {
      throw new Error('Web Share API not available');
    }
  } catch (err) {
    console.warn('Web Share API not available or failed:', err.message);
    console.log('Falling back to clipboard copy');
    
    try {
      const fallbackText = `${shareData.title}: ${shareData.text}\n${shareUrl}`;
      await navigator.clipboard.writeText(fallbackText);
      console.log('Share link copied to clipboard');
      alert('Link copied to clipboard! Share it with your friends.');
      return { 
        success: true, 
        shared: false, 
        message: 'Share link copied to clipboard',
        fallback: true
      };
    } catch (clipboardErr) {
      console.error('Clipboard copy also failed:', clipboardErr.message);
      alert(`Unable to share. Please share this link manually:\n${shareUrl}`);
      return { success: false, shared: false, error: clipboardErr.message };
    }
  }
};
