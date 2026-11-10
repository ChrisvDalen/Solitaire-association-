/* Headings and the words filed under them.
   Rules for this list (enforced by test/engine.test.js):
   - every word is unique across the whole list
   - words are at most 9 characters so they fit a narrow card
   - no word should plausibly belong under a second heading */
(function (root) {
  'use strict';

  var DATA = [
    { name: 'Fruit', words: ['Apple', 'Pear', 'Plum', 'Mango', 'Cherry', 'Grape', 'Peach', 'Melon'] },
    { name: 'Vegetables', words: ['Carrot', 'Leek', 'Spinach', 'Turnip', 'Radish', 'Celery', 'Kale', 'Parsnip'] },
    { name: 'Night sky', words: ['Comet', 'Nebula', 'Saturn', 'Galaxy', 'Meteor', 'Jupiter', 'Neptune', 'Pulsar'] },
    { name: 'Orchestra', words: ['Violin', 'Cello', 'Flute', 'Banjo', 'Harp', 'Trumpet', 'Oboe', 'Drum'] },
    { name: 'Birds', words: ['Robin', 'Heron', 'Finch', 'Magpie', 'Owl', 'Wren', 'Falcon', 'Puffin'] },
    { name: 'Fish', words: ['Trout', 'Salmon', 'Cod', 'Herring', 'Tuna', 'Pike', 'Sardine', 'Haddock'] },
    { name: 'Trees', words: ['Oak', 'Birch', 'Maple', 'Willow', 'Cedar', 'Elm', 'Beech', 'Poplar'] },
    { name: 'Flowers', words: ['Tulip', 'Daisy', 'Orchid', 'Lily', 'Poppy', 'Peony', 'Crocus', 'Dahlia'] },
    { name: 'Colours', words: ['Scarlet', 'Indigo', 'Maroon', 'Magenta', 'Beige', 'Crimson', 'Ochre', 'Mauve'] },
    { name: 'Weather', words: ['Drizzle', 'Hail', 'Fog', 'Thunder', 'Sleet', 'Breeze', 'Frost', 'Monsoon'] },
    { name: 'Kitchen', words: ['Whisk', 'Ladle', 'Spatula', 'Grater', 'Colander', 'Sieve', 'Tongs', 'Peeler'] },
    { name: 'Furniture', words: ['Sofa', 'Wardrobe', 'Stool', 'Dresser', 'Bench', 'Bookcase', 'Sideboard', 'Armchair'] },
    { name: 'Clothing', words: ['Jacket', 'Scarf', 'Mitten', 'Cardigan', 'Blouse', 'Sock', 'Trousers', 'Vest'] },
    { name: 'Body', words: ['Elbow', 'Ankle', 'Knee', 'Wrist', 'Shoulder', 'Thumb', 'Chin', 'Rib'] },
    { name: 'Sports', words: ['Tennis', 'Rugby', 'Hockey', 'Golf', 'Rowing', 'Judo', 'Archery', 'Karate'] },
    { name: 'Insects', words: ['Beetle', 'Wasp', 'Moth', 'Hornet', 'Gnat', 'Earwig', 'Mantis', 'Weevil'] },
    { name: 'Toolbox', words: ['Hammer', 'Chisel', 'Wrench', 'Pliers', 'Saw', 'Drill', 'Mallet', 'Spanner'] },
    { name: 'Dances', words: ['Waltz', 'Tango', 'Polka', 'Foxtrot', 'Rumba', 'Samba', 'Bolero', 'Jive'] },
    { name: 'Money', words: ['Dollar', 'Euro', 'Yen', 'Peso', 'Rupee', 'Krona', 'Franc', 'Dinar'] },
    { name: 'Gemstones', words: ['Ruby', 'Opal', 'Topaz', 'Emerald', 'Garnet', 'Sapphire', 'Jade', 'Amethyst'] },
    { name: 'Pasta', words: ['Penne', 'Fusilli', 'Ravioli', 'Linguine', 'Orzo', 'Rigatoni', 'Lasagne', 'Gnocchi'] },
    { name: 'Bakery', words: ['Bagel', 'Brioche', 'Scone', 'Crumpet', 'Pretzel', 'Muffin', 'Baguette', 'Focaccia'] },
    { name: 'Cheese', words: ['Brie', 'Gouda', 'Cheddar', 'Feta', 'Edam', 'Stilton', 'Ricotta', 'Halloumi'] },
    { name: 'Spices', words: ['Cumin', 'Saffron', 'Paprika', 'Nutmeg', 'Clove', 'Turmeric', 'Cardamom', 'Anise'] },
    { name: 'Dogs', words: ['Poodle', 'Beagle', 'Collie', 'Terrier', 'Spaniel', 'Whippet', 'Corgi', 'Pug'] },
    { name: 'Zoo', words: ['Zebra', 'Giraffe', 'Hippo', 'Lemur', 'Rhino', 'Panda', 'Gorilla', 'Meerkat'] },
    { name: 'Farm', words: ['Tractor', 'Barn', 'Plough', 'Haystack', 'Silo', 'Paddock', 'Trough', 'Orchard'] },
    { name: 'Boats', words: ['Canoe', 'Kayak', 'Ferry', 'Yacht', 'Barge', 'Dinghy', 'Tugboat', 'Gondola'] },
    { name: 'Office', words: ['Stapler', 'Printer', 'Folder', 'Notepad', 'Binder', 'Shredder', 'Envelope', 'Inkpad'] },
    { name: 'Card games', words: ['Poker', 'Rummy', 'Whist', 'Canasta', 'Cribbage', 'Baccarat', 'Pontoon', 'Patience'] },
    { name: 'Shapes', words: ['Circle', 'Square', 'Oval', 'Hexagon', 'Rhombus', 'Cube', 'Cone', 'Pyramid'] },
    { name: 'Maths', words: ['Fraction', 'Decimal', 'Algebra', 'Integer', 'Ratio', 'Quotient', 'Theorem', 'Vector'] },
    { name: 'Languages', words: ['Dutch', 'Hindi', 'Welsh', 'Swahili', 'Korean', 'Finnish', 'Arabic', 'Tamil'] },
    { name: 'Capitals', words: ['Paris', 'Cairo', 'Lima', 'Oslo', 'Tokyo', 'Nairobi', 'Ottawa', 'Lisbon'] },
    { name: 'Rivers', words: ['Nile', 'Danube', 'Thames', 'Ganges', 'Amazon', 'Rhine', 'Volga', 'Yukon'] },
    { name: 'Drinks', words: ['Espresso', 'Cocoa', 'Lemonade', 'Cider', 'Smoothie', 'Latte', 'Cola', 'Tonic'] },
    { name: 'Bedtime', words: ['Pillow', 'Duvet', 'Pyjamas', 'Blanket', 'Lullaby', 'Snore', 'Yawn', 'Dream'] },
    { name: 'Camping', words: ['Tent', 'Campfire', 'Lantern', 'Compass', 'Rucksack', 'Hammock', 'Firewood', 'Torch'] },
    { name: 'Seaside', words: ['Seashell', 'Sunshade', 'Lifeguard', 'Dune', 'Tide', 'Pebble', 'Surfboard', 'Pier'] },
    { name: 'Theatre', words: ['Stage', 'Curtain', 'Encore', 'Usher', 'Matinee', 'Script', 'Interval', 'Spotlight'] },
    { name: 'Bicycle', words: ['Pedal', 'Saddle', 'Spoke', 'Sprocket', 'Mudguard', 'Pannier', 'Tyre', 'Kickstand'] },
    { name: 'Hospital', words: ['Bandage', 'Syringe', 'Stretcher', 'Scalpel', 'Crutch', 'Splint', 'Ointment', 'Surgeon'] },
    { name: 'Castle', words: ['Moat', 'Turret', 'Dungeon', 'Rampart', 'Throne', 'Armoury', 'Gatehouse', 'Banner'] },
    { name: 'Landforms', words: ['Canyon', 'Plateau', 'Glacier', 'Valley', 'Delta', 'Cliff', 'Lagoon', 'Ravine'] },
    { name: 'Baby animals', words: ['Kitten', 'Lamb', 'Foal', 'Cygnet', 'Piglet', 'Duckling', 'Tadpole', 'Fawn'] },
    { name: 'Fabrics', words: ['Velvet', 'Denim', 'Linen', 'Tweed', 'Satin', 'Corduroy', 'Chiffon', 'Muslin'] },
    { name: 'Punctuation', words: ['Comma', 'Hyphen', 'Tilde', 'Bracket', 'Asterisk', 'Ellipsis', 'Ampersand', 'Semicolon'] },
    { name: 'Time', words: ['Minute', 'Decade', 'Century', 'Fortnight', 'Hour', 'Weekend', 'Midnight', 'Month'] }
  ];

  root.FU_DATA = DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
