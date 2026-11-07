// Bottom sheet shown when a building is tapped: name, capacity, walk time, hours, bookmark and share buttons.
// Peeks up from the bottom of the map; swipe up (or tap the handle) to see popular times.
import { useRef, useState } from 'react';
import Icon from './Icon.jsx';
import PopularTimesChart from './PopularTimesChart.jsx';
import OccupancyLegend from './OccupancyLegend.jsx';
import { OpenStatus } from './PlaceStats.jsx';
import { useApp } from '../AppContext.js';
import { fmtMiles, googleWalkingUrl, walk } from '../utils/geo.js';
import { hoursStatus, liveOccupancy } from '../utils/occupancy.js';

const SWIPE_PX = 30;
const PEEK_PX = 128;
const CLOSE_PX = 40;

function BuildingSheet({ place, expanded, onExpandedChange, onClose }) {
  const { now, examWeek, location, bookmarks, toast } = useApp();
  const sheetRef = useRef(null);
  const drag = useRef(null);
  const [dragHeight, setDragHeight] = useState(null);

  const status = hoursStatus(place, now);
  const occ = status.open ? liveOccupancy(place, now, { examWeek }) : 0;
  const people = Math.round(occ * place.capacity);
  const trip = walk(location, place);
  const saved = bookmarks.isBookmarked(place.id);

  const onPointerDown = (e) => {
    const sheet = sheetRef.current;
    const screen = sheet.parentElement;
    const topInset = parseFloat(getComputedStyle(sheet).getPropertyValue('--top-inset')) || 0;
    drag.current = {
      startY: e.clientY,
      startHeight: sheet.offsetHeight,
      maxHeight: screen.clientHeight - topInset - 56,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const { startY, startHeight, maxHeight } = drag.current;
    const height = startHeight - (e.clientY - startY);
    setDragHeight(Math.min(Math.max(height, 0), maxHeight));
  };

  const onPointerUp = (e) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    const height = dragHeight ?? drag.current.startHeight;
    drag.current = null;
    setDragHeight(null);
    if (Math.abs(dy) < SWIPE_PX) onExpandedChange(!expanded);
    else if (dy < 0) onExpandedChange(true);
    else if (height < PEEK_PX - CLOSE_PX) onClose();
    else onExpandedChange(false);
  };

  const onPointerCancel = () => {
    drag.current = null;
    setDragHeight(null);
  };

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?b=${place.id}`;
    const text = `${place.name} is ${status.open ? `${Math.round(occ * 100)}% full right now` : 'closed right now'} (Swamped)`;
    try {
      if (navigator.share) await navigator.share({ title: place.name, text, url });
      else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast('Link copied');
      }
    } catch {
      // Share sheet dismissed.
    }
  };

  const toggleBookmark = () => {
    bookmarks.toggle(place.id);
    toast(saved ? 'Removed from bookmarks' : 'Added to bookmarks');
  };

  return (
    <section
      ref={sheetRef}
      className={expanded ? 'sheet expanded' : 'sheet'}
      style={dragHeight === null ? undefined : { maxHeight: dragHeight, transition: 'none' }}
      aria-label={`${place.name} details`}
    >
      <button
        className="sheet-handle"
        aria-label={expanded ? 'Collapse details' : 'Expand details'}
        aria-expanded={expanded}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onExpandedChange(!expanded)}
      >
        <span className="grabber" />
      </button>

      <div className="sheet-body">
        <div className="sheet-head">
          <div className="sheet-info" onClick={() => !expanded && onExpandedChange(true)}>
            <h2>{place.name}</h2>
            <p className="count">
              {status.open
                ? `${people.toLocaleString()}/${place.capacity.toLocaleString()}`
                : `Closed · holds ${place.capacity.toLocaleString()}`}
            </p>
            <a
              className="walk-row"
              href={googleWalkingUrl(location, place)}
              target="_blank"
              rel="noreferrer"
              title={`Walking directions from ${location.label}`}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="walk" />
              <span>{trip.minutes} min</span>
              <span className="dot" aria-hidden="true" />
              <span>{fmtMiles(trip.miles)}</span>
            </a>
            <OpenStatus status={status} />
          </div>
          <div className="sheet-actions">
            <button
              className={saved ? 'circle-btn saved' : 'circle-btn'}
              aria-pressed={saved}
              aria-label={saved ? 'Remove bookmark' : 'Bookmark'}
              onClick={toggleBookmark}
            >
              <Icon name="sheetBookmark" />
            </button>
            <button className="circle-btn" aria-label="Share" onClick={share}>
              <Icon name="sheetShare" />
            </button>
            <button className="circle-btn" aria-label="Close" onClick={onClose}>
              <Icon name="sheetClose" />
            </button>
          </div>
        </div>

        <PopularTimesChart place={place} />
        <OccupancyLegend />
      </div>
    </section>
  );
}

export default BuildingSheet;
