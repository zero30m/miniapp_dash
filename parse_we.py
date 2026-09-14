
import re
import json

def to_title_case(text):
    return ' '.join(word.capitalize() for word in text.split())

def generate_name(chinese_text):
    # Simple heuristic: take first 4-6 chars, remove punctuation
    clean = re.sub(r'[?？,，.!',]', '', chinese_text)
    return clean[:4]

cards = []
current_card = {}
card_id = 1

with open('we.txt', 'r', encoding='utf-8') as f:
    lines = [l.strip() for l in f if l.strip()]

i = 0
while i < len(lines):
    line = lines[i]
    
    # Skip section headers
    if line.startswith('---') or (line.startswith('卡牌') and len(line) < 10) or '第七页卡牌' in line:
        i += 1
        continue
        
    # Pattern 1: Number + English
    match_en = re.match(r'^(\d+)\.\s+(.*)$', line)
    
    # Pattern 2: Sometimes English and Chinese are on the same line (Card 2)
    # e.g. "1. WHY ...? 我的风格...?"
    # We need to detect if there is Chinese in the line
    has_chinese = re.search(r'[\u4e00-\u9fff]', line)
    
    if match_en:
        num = match_en.group(1)
        content_en = match_en.group(2)
        content_cn = ""
        
        if has_chinese:
            # Split by first Chinese char or punctuation?
            # English usually ends with ? or .
            # But line 122: 1. WHY ... ME? 我的...
            # Split by '?' might be safer if English ends with ?
            parts = re.split(r'([?|!|\.])\s+', line, maxsplit=1)
            # This is tricky because English might have multiple sentences.
            # Let's assume the Chinese starts after the first occurance of a Chinese char
            cn_start = re.search(r'[\u4e00-\u9fff]', line)
            if cn_start:
                idx = cn_start.start()
                content_en = line[len(num)+2 : idx].strip() # +2 for ". "
                content_cn = line[idx:].strip()
                i += 1 # We consumed this line fully
            else:
                # Expect next line to be Chinese
                if i + 1 < len(lines):
                    content_cn = lines[i+1]
                    i += 2
                else:
                    i += 1
        else:
            # Expect next line to be Chinese
            if i + 1 < len(lines):
                content_cn = lines[i+1]
                i += 2
            else:
                i += 1
                
        # Process
        english_clean = to_title_case(content_en.lower())
        name = generate_name(content_cn)
        
        # Subtitle logic
        subtitle = "We're Not Strangers"
        if "WILDCARD" in content_en:
            subtitle = "Wildcard"
            english_clean = english_clean.replace("Wildcard ", "")
            name = "Wildcard"
        elif "REMINDER" in content_en:
            subtitle = "Reminder"
            english_clean = english_clean.replace("Reminder ", "")
            name = "Reminder"
            
        cards.append({
            "id": card_id,
            "name": name,
            "subtitle": subtitle,
            "description": content_cn,
            "englishDesc": english_clean
        })
        card_id += 1
        
    else:
        # Maybe a line without number? Skip for now
        i += 1

# Output JS format
print("/**")
print(" * 不是陌生人 - 卡牌数据")
print(" */")
print("const CARDS_WE = " + json.dumps(cards, ensure_ascii=False, indent=2) + ";")
print("")
print("// 预计算卡牌映射表")
print("const CARD_MAP_WE = CARDS_WE.reduce((acc, card) => {")
print("  acc[card.id] = card;")
print("  return acc;")
print("}, {});")
print("")
print("function shuffleArray(array) {")
print("  const arr = array.slice();")
print("  for (let i = arr.length - 1; i > 0; i--) {")
print("    const j = Math.floor(Math.random() * (i + 1));")
print("    [arr[i], arr[j]] = [arr[j], arr[i]];")
print("  }")
print("  return arr;")
print("}")
print("")
print("module.exports = {")
print("  CARDS_WE,")
print("  CARD_MAP_WE,")
print("  shuffleArray")
print("};")
