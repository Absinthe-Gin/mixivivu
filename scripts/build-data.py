"""Normalize raw public API captures from mixivivu.com into the static
mock-API files served from public/data.

Usage:
    python -X utf8 scripts/build-data.py <raw-dir>

<raw-dir> must contain the JSON captured from the public endpoints
(products.json, hotels.json, blogs.json, categories.json, feat_room.json,
features_hotel.json, cities.json, reviews.json) plus static.json (page
content captured with Playwright). Reviewer phone numbers and e-mails are
never written: only the fields shown on the public page are kept.
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

RAW = sys.argv[1]
ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'public', 'data')


def load(name):
    with open(os.path.join(RAW, name), encoding='utf8') as f:
        return json.load(f)


def save(rel, data):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))


def result_data(obj):
    r = obj.get('result', obj)
    r = r.get('result', r)
    return r['data']


def rating(item):
    return {
        'numReviews': item.get('numReviews') or 0,
        'score': round(item.get('finalScoreReview') or 0, 2),
        'starCount': item.get('starCount') or {},
    }


def clean_blocks(desc):
    """Keep only Editor.js block data the front end renders."""
    blocks = []
    for b in (desc or {}).get('blocks', []):
        t, d = b.get('type'), b.get('data', {})
        if t == 'paragraph':
            blocks.append({'type': 'paragraph', 'text': d.get('text', '')})
        elif t == 'header':
            blocks.append({'type': 'header', 'level': d.get('level', 2), 'text': d.get('text', '')})
        elif t == 'image':
            url = (d.get('file') or {}).get('url')
            if url:
                blocks.append({'type': 'image', 'url': url, 'caption': d.get('caption', '')})
        elif t == 'list':
            items = [i if isinstance(i, str) else i.get('content', '') for i in d.get('items', [])]
            blocks.append({'type': 'list', 'style': d.get('style', 'unordered'), 'items': items})
    return blocks


def date_only(value):
    return (value or '')[:10] or None


# ---------- taxonomies ----------
categories = [{'id': c['_id'], 'name': c['name'], 'image': c['image']} for c in result_data(load('categories.json'))]
save('categories.json', categories)

features = [{'id': f['_id'], 'text': f['text'], 'icon': f.get('icon'), 'type': f.get('type', 'ship')}
            for f in result_data(load('feat_room.json'))]
save('features.json', features)

hotel_feature_raw = result_data(load('features_hotel.json'))
hotel_features = [{'id': f['_id'], 'text': f['text']} for f in hotel_feature_raw]
save('hotel-features.json', hotel_features)

cities = [{'id': c['_id'], 'name': c['name']} for c in result_data(load('cities.json'))]
save('cities.json', cities)

# ---------- ships ----------
reviews = load('reviews.json')
ships = load('products.json')
index = []
for s in ships:
    if not s.get('active', True):
        continue
    spec = (s.get('spec') or {}).get('ship') or {}
    card = {
        'id': s['_id'],
        'slug': s['slug'],
        'title': s['title'].strip(),
        'thumbnail': s.get('thumbnail'),
        'categoryId': s.get('category'),
        'price': s.get('defaultPrice') or 0,
        'features': s.get('features', []),
        'spec': {'launch': spec.get('launch'), 'cabin': spec.get('cabin'), 'shell': spec.get('shell'),
                 'trip': spec.get('trip'), 'admin': spec.get('admin')},
        **rating(s),
    }
    index.append(card)
    detail = {
        **card,
        'address': s.get('address'),
        'mapLink': s.get('mapLink'),
        'mapIframeLink': s.get('mapIframeLink'),
        'schedule': s.get('schedule'),
        'scheduleLink': s.get('scheduleLink'),
        'images': s.get('imgs', []),
        'highlights': [t.strip() for t in s.get('shortDescription', []) if t and t.strip()],
        'content': clean_blocks(s.get('longDescription')),
        'rooms': [{
            'id': r['_id'], 'title': r['title'].strip(), 'size': r.get('size'), 'maxPersons': r.get('maxPersons'),
            'price': r.get('price') or 0, 'salePrice': r.get('salePrices') or 0,
            'features': r.get('features') or [], 'images': r.get('imgs') or [],
        } for r in s.get('rooms', []) if r.get('active', True)],
        'reviews': sorted(
            [{'id': r['id'], 'name': r['name'], 'score': r['score'], 'comment': r['comment'], 'date': date_only(r['created'])}
             for r in reviews.get(s['_id'], [])],
            key=lambda r: r['date'] or ''),
    }
    save(f"ships/{s['slug']}.json", detail)
save('ships.json', index)

# ---------- hotels ----------
hotels = load('hotels.json')
index = []
for h in hotels:
    if not h.get('active', True):
        continue
    feats = [f['_id'] if isinstance(f, dict) else f for f in h.get('features', [])]
    spec = (h.get('spec') or {}).get('hotel') or {}
    city = h.get('city') or {}
    card = {
        'id': h['_id'],
        'slug': h['slug'],
        'title': h['title'].strip(),
        'thumbnail': h.get('thumbnail'),
        'cityId': city.get('_id'),
        'cityName': city.get('name'),
        'price': h.get('salePrice') or h.get('defaultPrice') or 0,
        'originalPrice': h.get('defaultPrice') or 0,
        'standard': h.get('standard'),
        'features': feats,
        'spec': {'totalRooms': spec.get('totalRooms'), 'admin': spec.get('admin')},
        **rating(h),
    }
    index.append(card)
    detail = {
        **card,
        'address': h.get('address'),
        'mapLink': h.get('mapLink'),
        'mapIframeLink': h.get('mapIframeLink'),
        'images': h.get('imgs', []),
        'highlights': [t.strip() for t in h.get('shortDescription', []) if t and t.strip()],
        'content': clean_blocks(h.get('longDescription')),
        'rooms': [{
            'id': r['_id'], 'title': r['title'].strip(), 'size': r.get('size'), 'maxPersons': r.get('maxPersons'),
            'price': r.get('price') or 0, 'salePrice': r.get('salePrices') or 0,
            'features': [f['text'] if isinstance(f, dict) else f for f in (r.get('features') or [])],
            'images': r.get('imgs') or [],
        } for r in h.get('rooms', []) if r.get('active', True)],
        'reviews': [],
    }
    save(f"hotels/{h['slug']}.json", detail)
save('hotels.json', index)

# ---------- blogs ----------
blogs = load('blogs.json')
index = []
for b in blogs:
    if not b.get('active', True):
        continue
    card = {
        'id': b['_id'], 'slug': b['slug'], 'title': b['title'].strip(),
        'description': (b.get('shortDescription') or '').strip(), 'thumbnail': b.get('thumbnail'),
        'type': b.get('typeBlog') or 'travel', 'date': date_only(b.get('createdDate')),
    }
    index.append(card)
    save(f"blogs/{b['slug']}.json", {**card, 'content': clean_blocks(b.get('longDescription'))})
index.sort(key=lambda b: b['date'] or '', reverse=True)
save('blogs.json', index)


# ---------- static pages ----------
class Sanitizer(HTMLParser):
    """Keep a small whitelist of tags and the typography classes."""
    KEEP = {'p', 'div', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'img', 'h5', 'h6', 'span', 'table', 'tr', 'td', 'th', 'tbody', 'thead'}
    CLASSES = {'subheading', 'md', 'sm', 'lg', 'xl', 'xs', 'label'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.KEEP:
            return
        a = dict(attrs)
        parts = [tag]
        cls = [c for c in (a.get('class') or '').split() if c in self.CLASSES]
        if cls:
            parts.append(f'class="{" ".join(cls)}"')
        if tag == 'a' and a.get('href'):
            parts.append(f'href="{html.escape(a["href"])}"')
        if tag == 'img':
            src = a.get('src', '')
            if src.startswith('data:'):
                return
            src = src.replace('/payment-type.png', '/assets/images/payment-type.png')
            parts.append(f'src="{html.escape(src)}" alt="mixivivu"')
        self.out.append('<' + ' '.join(parts) + '>')

    def handle_endtag(self, tag):
        if tag in self.KEEP and tag not in ('br', 'img'):
            self.out.append(f'</{tag}>')

    def handle_data(self, data):
        self.out.append(html.escape(data, quote=False))


def sanitize(fragment):
    s = Sanitizer()
    s.feed(fragment)
    out = ''.join(s.out)
    out = re.sub(r'<span>\s*</span>', '', out)
    return out


static = load('static.json')
LEGAL = {
    'dieu-khoan-va-dieu-kien': '/dieu-khoan-va-dieu-kien',
    'chinh-sach-rieng-tu': '/chinh-sach-rieng-tu',
    'quy-dinh-chung-va-luu-y': '/quy-dinh-chung-va-luu-y',
    'huong-dan-su-dung': '/huong-dan-su-dung',
    'hinh-thuc-thanh-toan': '/hinh-thuc-thanh-toan',
    'khach-san-quy-dinh-chung-va-luu-y': '/khach-san/quy-dinh-chung-va-luu-y',
}
for key, route in LEGAL.items():
    raw = static[route]['html']
    title = re.search(r'<h4>(.*?)</h4>', raw).group(1)
    # drop the section header (title + decorative border)
    body = re.sub(r'<div class="SectionHeader_sectionHeader[\s\S]*?</h4>[\s\S]*?</span></div></div></div>', '', raw, count=1)
    save(f'pages/{key}.json', {'title': html.unescape(title), 'html': sanitize(body)})


def faqs(route):
    raw = static[route]['html']
    items = re.findall(r'<div class="subheading sm">([\s\S]*?)</div>[\s\S]*?<div class="Faqs_content[^"]*">([\s\S]*?)</div></div></div></div>', raw)
    out = []
    for q, a in items:
        out.append({'question': html.unescape(re.sub('<[^>]+>', '', q)).strip(), 'answer': sanitize(a)})
    return out


save('pages/faq-ship.json', faqs('/cau-hoi-thuong-gap'))
save('pages/faq-hotel.json', faqs('/khach-san/cau-hoi-thuong-gap'))
print('ok')
