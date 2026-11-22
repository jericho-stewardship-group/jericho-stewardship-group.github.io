---
title: "Gallery"
permalink: /gallery/
---

<p class="gallery-intro">Here are some photos of us at work, having fun, and some of the flora and fauna we observe in Jericho Park. If you have images of Jericho you would like to share, <a href="mailto:jerichostewardship@gmail.com">please email us</a>.</p>

<div class="gallery-controls">
  <p>Browse photos by stewardship event.</p>
  <label for="gallery-year">Filter by year
    <select id="gallery-year">
      <option value="all">All years</option>
      {% assign gallery_years = site.data.gallery.albums | map: "year" | uniq | sort | reverse %}
      {% for year in gallery_years %}
      <option value="{{ year }}">{{ year }}</option>
      {% endfor %}
    </select>
  </label>
</div>
<p class="event-note" id="gallery-status" aria-live="polite">{{ site.data.gallery.albums.size }} photo albums</p>

<div class="album-list" id="album-list">
  {% for album in site.data.gallery.albums %}
  <details class="album-card" data-year="{{ album.year }}">
    <summary>
      <img class="album-cover" src="{{ album.photos.first.thumb | relative_url }}" width="{{ album.photos.first.width }}" height="{{ album.photos.first.height }}" alt="" loading="lazy">
      <span class="album-summary">
        <strong>{{ album.title | escape }}</strong>
        <span>{{ album.photos.size }} photos · {{ album.description | escape }}</span>
      </span>
    </summary>
    <div class="album-photos" role="group" aria-label="Photos from {{ album.title | escape }}">
      {% for photo in album.photos %}
      <button class="photo-button" type="button" data-full-src="{{ photo.full | relative_url }}" data-width="{{ photo.width }}" data-height="{{ photo.height }}" data-alt="{{ photo.alt | escape }}" data-caption="{{ photo.caption | escape }}" aria-label="View photo {{ forloop.index }} of {{ forloop.length }}: {{ photo.caption | default: album.title | escape }}">
        <img src="{{ photo.thumb | relative_url }}" width="{{ photo.width }}" height="{{ photo.height }}" alt="" loading="lazy">
        {% if photo.caption != "" %}
        <span>{{ photo.caption | escape }}</span>
        {% endif %}
      </button>
      {% endfor %}
    </div>
  </details>
  {% endfor %}
</div>

<blockquote>
  <p>For over 40 years I have reveled in the beauty of the forest, the estuarine marsh, and other such places where I have spent much of my time. When stresses and strains get to me, even now, I need only take a forest walk, run my hands along the furrowed bark of a Douglas-fir, or watch the yellow and brown, big-leaf maple leaves sail effortlessly to the ground to be rejuvenated.</p>
  <cite>Neil Dawe, B.C. naturalist and author</cite>
</blockquote>
