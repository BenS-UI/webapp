// NAV SCROLL DETECTION
window.addEventListener('scroll', () => {
  const nav = document.querySelector('.navbar');
  if (nav) {
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }
});

// Parallax effect
const applyParallax = () => {
  document.querySelectorAll('[data-parallax-speed]').forEach(el => {
    const speed = parseFloat(el.dataset.parallaxSpeed);
    const rect = el.getBoundingClientRect();
    const centerOfViewport = window.innerHeight / 2;
    const elementCenter = rect.top + rect.height / 2;
    const distanceToCenter = centerOfViewport - elementCenter;
    const translateY = distanceToCenter * speed;

    if (el.classList.contains('hero-bg')) {
      el.style.transform = `translateY(${translateY * 0.5}px) scale(1.1)`;
    } else {
      el.style.transform = `translateY(${translateY}px)`;
    }
  });
};

window.addEventListener('scroll', applyParallax);
window.addEventListener('resize', applyParallax);

// PAGE TRANSITION (FADE-IN)
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('page-loaded');

  // Initial parallax application on load
  applyParallax();

  // MORE BUTTON
  const moreBtn = document.querySelector('.more-btn');
  const navLinks = document.querySelector('.nav-links');

  if (moreBtn && navLinks) {
    moreBtn.addEventListener('click', () => {
      navLinks.classList.toggle('active');
    });
  }

  // CUSTOM CURSOR
  if (window.matchMedia('(pointer: fine)').matches) {
    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    document.body.appendChild(cursor);

    let mouseX = 0, mouseY = 0, posX = 0, posY = 0;

    const lerp = (start, end, factor) => start + (end - start) * factor;

    function animateCursor() {
      posX = lerp(posX, mouseX, 1);
      posY = lerp(posY, mouseY, 1);
      cursor.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
      requestAnimationFrame(animateCursor);
    }
    animateCursor();

    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    const hoverTargets = document.querySelectorAll('a, button, .project-card');
    hoverTargets.forEach(el => {
      el.addEventListener('mouseenter', () => cursor.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('hover'));
    });
  }

  // INTERSECTION OBSERVER FOR FADE-IN ANIMATIONS
  const elements = document.querySelectorAll('.fade-in, .project-card');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  elements.forEach(element => observer.observe(element));

  // THEME TOGGLE FUNCTIONALITY
  const themeToggleBtn = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme');

  const applyTheme = (themeName) => {
    document.body.dataset.theme = themeName;
    localStorage.setItem('theme', themeName);
    const icon = themeToggleBtn.querySelector('.theme-icon');
    if (themeName === 'dark') {
      icon.textContent = 'light_mode';
    } else {
      icon.textContent = 'dark_mode';
    }
  };

  if (currentTheme) {
    applyTheme(currentTheme);
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    applyTheme('dark');
  } else {
    applyTheme('light');
  }

  themeToggleBtn.addEventListener('click', () => {
    const newTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });

  // GALLERY: prevent context menu on images to discourage downloading and randomize order
  const galleryContainer = document.getElementById('gallery-container');
  if (galleryContainer) {
    // Disable right-click context menu on the gallery
    galleryContainer.addEventListener('contextmenu', e => {
      e.preventDefault();
    });
    // Randomize the order of the gallery items on each page load. This creates a fresh layout
    // when used in combination with CSS columns.
    const items = Array.from(galleryContainer.children);
    const shuffled = items.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach(item => galleryContainer.appendChild(item));
  }

  // Initialize VanillaTilt with glare on project cards and gallery items
  const tiltTargets = document.querySelectorAll('.project-card, #gallery .grid-item');
  if (typeof VanillaTilt !== 'undefined' && tiltTargets.length) {
    // Configure tilt options to create a smooth, repelling effect. Increase max a bit and
    // slow down the movement for desktop; on mobile reduce the intensity to avoid jitter.
    const tiltOptions = {
      max: 20,                // Increased tilt strength for a more dramatic repelling effect
      speed: 600,             // Smooth and refined motion speed
      reverse: true,          // Push corners away from the cursor rather than attract
      glare: true,
      'max-glare': 0.4,
      gyroscope: false,
      easing: 'cubic-bezier(.17,.67,.83,.67)',
      perspective: 900
    };
    // On mobile, reduce tilt intensity and speed to avoid jitter
    if (window.matchMedia('(max-width: 768px)').matches) {
      tiltOptions.max = 10;
      tiltOptions.speed = 400;
    }
    VanillaTilt.init(tiltTargets, tiltOptions);
  }

  // Ensure only one audio track plays at a time in the music player. When a track starts
  // playing, pause all other tracks. This prevents multiple songs from playing simultaneously.
  const audioPlayers = document.querySelectorAll('.music-card audio');
  if (audioPlayers.length > 1) {
    audioPlayers.forEach(player => {
      player.addEventListener('play', () => {
        audioPlayers.forEach(other => {
          if (other !== player) {
            other.pause();
          }
        });
      });
    });
  }

  // Equalizer animation for music cards
  const eqIntervals = new Map();
  audioPlayers.forEach(player => {
    const card = player.closest('.music-card');
    const bars = card ? card.querySelectorAll('.eq-bar') : null;
    // Helper to start updating the bar heights randomly
    const startEq = () => {
      if (!bars) return;
      // Clear any existing interval for this player
      if (eqIntervals.has(player)) {
        clearInterval(eqIntervals.get(player));
      }
      const intervalId = setInterval(() => {
        bars.forEach(bar => {
          // Generate a random height between 20% and 100%
          const randomHeight = Math.random() * 0.8 + 0.2;
          bar.style.height = `${randomHeight * 1}rem`;
        });
      }, 200);
      eqIntervals.set(player, intervalId);
    };
    // Helper to stop the equalizer animation
    const stopEq = () => {
      if (!bars) return;
      const id = eqIntervals.get(player);
      if (id) {
        clearInterval(id);
        eqIntervals.delete(player);
      }
      // Reset bars to minimal height
      bars.forEach(bar => {
        bar.style.height = '0.2rem';
      });
    };
    player.addEventListener('play', () => {
      // Pause other players and stop their equalizers
      audioPlayers.forEach(other => {
        if (other !== player) {
          other.pause();
          // Stop EQ for the other
          const id = eqIntervals.get(other);
          if (id) {
            clearInterval(id);
            eqIntervals.delete(other);
            const otherCard = other.closest('.music-card');
            const otherBars = otherCard ? otherCard.querySelectorAll('.eq-bar') : null;
            if (otherBars) {
              otherBars.forEach(bar => bar.style.height = '0.2rem');
            }
          }
        }
      });
      startEq();
    });
    player.addEventListener('pause', stopEq);
    player.addEventListener('ended', stopEq);
  });

  // Apply dynamic backlight effect to gallery images by sampling colors along the image edges.
  const applyBacklight = () => {
    const galleryImages = document.querySelectorAll('#gallery .grid-item img');
    galleryImages.forEach(img => {
      // Skip remote images due to cross-origin restrictions
      if (img.src.startsWith('http')) return;
      const parent = img.closest('.grid-item');
      if (!parent) return;
      // Ensure image is loaded
      if (!img.complete) {
        img.addEventListener('load', () => applyBacklight());
        return;
      }
      // Create offscreen canvas to sample colors
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      canvas.width = width;
      canvas.height = height;
      try {
        ctx.drawImage(img, 0, 0, width, height);
      } catch (e) {
        // If drawImage fails due to security restrictions, skip
        return;
      }
      // Sample a square region at each corner (~10% of the smaller dimension). This
      // focuses on a border of roughly 2–3rem on typical screens, capturing the
      // most representative edge colors for the backlight.
      const sampleSize = Math.floor(Math.min(width, height) * 0.1);
      const avgColor = (x, y) => {
        const data = ctx.getImageData(x, y, sampleSize, sampleSize).data;
        let r = 0, g = 0, b = 0;
        const count = sampleSize * sampleSize;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
        }
        return {
          r: Math.round(r / count),
          g: Math.round(g / count),
          b: Math.round(b / count)
        };
      };
      const tl = avgColor(0, 0);
      const tr = avgColor(width - sampleSize, 0);
      const bl = avgColor(0, height - sampleSize);
      const br = avgColor(width - sampleSize, height - sampleSize);
      // Build box-shadow with multiple colored glows based on corner colors
      const shadows = [tl, tr, bl, br].map(c => `0 0 30px 5px rgba(${c.r},${c.g},${c.b},0.6)`).join(',');
      parent.style.boxShadow = shadows;
    });
  };
  // Invoke backlight effect after window load to ensure images are ready
  window.addEventListener('load', applyBacklight);

  // Speed up and reverse the letter columns when hovering over the design section
  const systemsSection = document.getElementById('systems');
  if (systemsSection) {
    const adjustLetterAnimation = (reverse, duration) => {
      const columns = document.querySelectorAll('.letters-column');
      columns.forEach((column, idx) => {
        // Determine base direction: odd columns start in reverse; even columns start normal
        let baseDirection = idx % 2 === 0 ? 'normal' : 'reverse';
        // If reverse flag is true, flip the direction
        if (reverse) {
          baseDirection = baseDirection === 'normal' ? 'reverse' : 'normal';
        }
        column.style.animation = `scroll-letters ${duration}s linear infinite ${baseDirection}`;
      });
    };
    // When pointer is over the systems section, invert directions and speed up
    systemsSection.addEventListener('mousemove', () => {
      adjustLetterAnimation(true, 20);
    });
    // On leaving the section, restore original animation
    systemsSection.addEventListener('mouseleave', () => {
      adjustLetterAnimation(false, 60);
    });
  }

  // Initialize the ElectricBlue hero background (swirling particles) for the hero section.
  // Disabled: This call is commented out in favor of the WebGL2 swirl effect from test.html.
  // initElectricBlueHero();

  // If a blog canvas is present, initialize a smaller swirling effect for the blog page.
  if (document.getElementById('blog-gl')) {
    // Disabled: The ElectricBlue blog swirl initialization is handled inline in blog.html.
    // initElectricBlueBlog();
  }


  // Create the scrolling letters background for the "I Design" section. This generates
  // multiple columns of random alphanumeric characters that slowly scroll and
  // periodically blur individual characters for a subtle, tech-inspired texture.
  const lettersBg = document.querySelector('.letters-bg');
  if (lettersBg) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');
    // Clear any existing columns to avoid duplication
    lettersBg.innerHTML = '';
    for (let i = 0; i < 20; i++) {
      const column = document.createElement('div');
      column.className = 'letters-column';
      column.style.display = 'flex';
      column.style.alignItems = 'center';
      column.style.justifyContent = 'center';
      const direction = i % 2 === 0 ? 'normal' : 'reverse';
      column.style.animation = `scroll-letters 60s linear infinite ${direction}`;
      for (let j = 0; j < 200; j++) {
        const span = document.createElement('span');
        span.textContent = letters[Math.floor(Math.random() * letters.length)];
        span.style.color = '#888';
        span.style.textAlign = 'center';
        column.appendChild(span);
      }
      lettersBg.appendChild(column);
    }
    setInterval(() => {
      const spans = lettersBg.querySelectorAll('span');
      spans.forEach(span => {
        if (Math.random() < 0.05) {
          span.style.filter = 'blur(5px)';
          setTimeout(() => span.style.filter = 'none', Math.random() * 2000 + 1000);
        }
      });
    }, 1000);
  }
});

// Initialise the ElectricBlue hero background. This function creates a swirling
// particle system on the canvas with id="bg". The particles rotate slowly by
// default, accelerate when hovering over the hero, disperse on click and
// reassemble after a brief delay. The animation pauses when the hero is not
// visible in the viewport. Camera distance adjusts for mobile for better
// readability.
function initElectricBlueHero() {
  const heroSection = document.getElementById('hero');
  const canvas = document.getElementById('bg');
  if (!heroSection || !canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = window.innerWidth < 768 ? 12 : 8;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const particleCount = 1500;
  const positions = new Float32Array(particleCount * 3);
  const originPositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 5;
    const y = (Math.random() - 0.5) * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    originPositions[i * 3] = x;
    originPositions[i * 3 + 1] = y;
    originPositions[i * 3 + 2] = z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(0x00A8E8),
    size: 0.04,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);

  let swirlSpeed = 0.004;
  let isPaused = false;
  function animate() {
    requestAnimationFrame(animate);
    if (!isPaused) {
      points.rotation.y += swirlSpeed;
    }
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  heroSection.addEventListener('mouseenter', () => {
    swirlSpeed = 0.02;
  });
  heroSection.addEventListener('mousemove', () => {
    swirlSpeed = 0.02;
  });
  heroSection.addEventListener('mouseleave', () => {
    swirlSpeed = 0.004;
  });

  heroSection.addEventListener('click', () => {
    const pos = geometry.attributes.position.array;
    const startPositions = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) {
      startPositions[i] = pos[i];
      pos[i] = (Math.random() - 0.5) * 20;
    }
    geometry.attributes.position.needsUpdate = true;
    swirlSpeed = 0.004;
    setTimeout(() => {
      const duration = 4000;
      const startTime = performance.now();
      function returnAnim(now) {
        const elapsed = now - startTime;
        const ratio = Math.min(elapsed / duration, 1);
        for (let i = 0; i < pos.length; i++) {
          pos[i] = startPositions[i] + (originPositions[i] - startPositions[i]) * ratio;
        }
        geometry.attributes.position.needsUpdate = true;
        if (ratio < 1) {
          requestAnimationFrame(returnAnim);
        }
      }
      requestAnimationFrame(returnAnim);
    }, 5000);
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      isPaused = !entry.isIntersecting;
    });
  }, { threshold: 0.1 });
  observer.observe(heroSection);
}

// Initialise a smaller ElectricBlue swirling background for the blog coming soon page.
// This function mirrors the hero effect but targets a specific canvas (#blog-gl)
// and uses fewer particles so the animation performs well at a reduced scale.
function initElectricBlueBlog() {
  const canvas = document.getElementById('blog-gl');
  if (!canvas || typeof THREE === 'undefined') return;
  const scene = new THREE.Scene();
  // Use square aspect for the small canvas
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 8;
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  // Set size based on current canvas dimensions and update on resize
  function setSize() {
    const width = canvas.clientWidth || 300;
    const height = canvas.clientHeight || 300;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  setSize();
  window.addEventListener('resize', setSize);
  const particleCount = 800;
  const positions = new Float32Array(particleCount * 3);
  const originPositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 3;
    const y = (Math.random() - 0.5) * 2;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    originPositions[i * 3] = x;
    originPositions[i * 3 + 1] = y;
    originPositions[i * 3 + 2] = z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: new THREE.Color(0x00A8E8),
    size: 0.06,
    transparent: true,
    opacity: 0.8,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  scene.add(points);
  let swirlSpeed = 0.006;
  let isPaused = false;
  function animate() {
    requestAnimationFrame(animate);
    if (!isPaused) {
      points.rotation.y += swirlSpeed;
    }
    renderer.render(scene, camera);
  }
  animate();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      isPaused = !entry.isIntersecting;
    });
  }, { threshold: 0.1 });
  observer.observe(canvas);
  canvas.addEventListener('mouseenter', () => {
    swirlSpeed = 0.02;
  });
  canvas.addEventListener('mousemove', () => {
    swirlSpeed = 0.02;
  });
  canvas.addEventListener('mouseleave', () => {
    swirlSpeed = 0.006;
  });
  canvas.addEventListener('click', () => {
    const pos = geometry.attributes.position.array;
    const startPositions = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i++) {
      startPositions[i] = pos[i];
      pos[i] = (Math.random() - 0.5) * 20;
    }
    geometry.attributes.position.needsUpdate = true;
    swirlSpeed = 0.006;
    setTimeout(() => {
      const duration = 4000;
      const startTime = performance.now();
      function returnAnim(now) {
        const elapsed = now - startTime;
        const ratio = Math.min(elapsed / duration, 1);
        for (let i = 0; i < pos.length; i++) {
          pos[i] = startPositions[i] + (originPositions[i] - startPositions[i]) * ratio;
        }
        geometry.attributes.position.needsUpdate = true;
        if (ratio < 1) {
          requestAnimationFrame(returnAnim);
        }
      }
      requestAnimationFrame(returnAnim);
    }, 5000);
  });
}

// Initialise floating reeded, prismatic, colour and glass blocks. These blocks
// drift gently across the viewport, simulating prismatic refraction and
// translucent glass. On hover, a block temporarily moves aside to reveal
// underlying content. This enhances the site with an Awwwards-like layered
// aesthetic while remaining performant.

// /scripts.js — ConvAI site-wide loader (runs once)
(() => {
  if (window.__convaiLoaded) return;
  window.__convaiLoaded = true;

  const mount = () => {
    // Add the widget element once
    if (!document.querySelector('elevenlabs-convai')) {
      const el = document.createElement('elevenlabs-convai');
      el.setAttribute('agent-id', 'agent_01k0a396khf3wr7ndjmt03pk33');
      document.body.appendChild(el);
    }

    // Load the embed script once
    if (!document.querySelector('script[src*="convai-widget-embed"]')) {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
      s.async = true;
      s.type = 'text/javascript';
      document.head.appendChild(s);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();