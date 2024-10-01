// Get all img tags from the document
const images = document.querySelectorAll('img');

// Function to open the lightbox
function openLightbox(img) {
  img.classList.add('lightbox');
  document.body.classList.add('lightbox-active');
  
  // Add a temporary listener to close the lightbox when the image is clicked
  img.addEventListener('click', closeOnClick);
}

// Function to close the lightbox
function closeLightbox() {
  const activeImage = document.querySelector('img.lightbox');
  if (activeImage) {
    activeImage.classList.remove('lightbox');
    document.body.classList.remove('lightbox-active');
    
    // Remove the click event listener from the active image
    activeImage.removeEventListener('click', closeOnClick);
  }
}

// Temporary function to handle closing the lightbox when clicking the active image
function closeOnClick(e) {
  e.stopPropagation();  // Prevent the click from bubbling up to the document
  closeLightbox();
}

// Loop through each image and add a click event listener to open the lightbox
images.forEach(img => {
  img.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event from bubbling to the document

    // If the image is already in lightbox mode, close it
    if (img.classList.contains('lightbox')) {
      closeLightbox();
    } else {
      openLightbox(img); // Otherwise, open it in lightbox
    }
  });
});

// Add event listener for clicking anywhere outside the image to close the lightbox
document.addEventListener('click', (e) => {
  const activeImage = document.querySelector('img.lightbox');
  if (activeImage && !e.target.closest('img.lightbox')) {
    closeLightbox();
  }
});

// Add event listener for keypress (e.g., 'Escape' key)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
  }
});