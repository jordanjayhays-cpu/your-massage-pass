/**
 * Studio photos.
 *
 * A studio's OWN photo (partners.cover_url, else its first gallery photo; see
 * ownStudioPhoto in supabase.ts) always wins and stands for the place. Every
 * other studio gets a stock photo from STOCK_PHOTOS, and a stock photo is
 * only ever shown with a visible "Stock photo" label (StudioPhoto component),
 * never as if it were the studio's room.
 *
 * 7 Nov (Jordan): "put photos for each studio even if it's stock photos
 * please, everyone should be different".
 *
 * The pool: 129 photos checked by eye (124 from Pexels, 5 from Unsplash, both
 * licences allow free use without credit). No faces as the subject, no logos
 * or visible text, no near-duplicates. Plain URLs, so there are no API calls
 * at runtime. Never Google Places photos or images from a studio's website.
 *
 * Who gets which photo: see assignStockSlots below. The slots are computed
 * once per visit from the full studio list (loadStockPhotos in supabase.ts),
 * so a studio has the same photo on every page: the /studios card, the map
 * popup, the studio page, /compare, the home page and "Book again".
 */

/** Hand-checked stock photos, 800px wide. Order matters: it is the slot number. */
export const STOCK_PHOTOS: readonly string[] = [
  "https://images.pexels.com/photos/19641818/pexels-photo-19641818.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 19641818, Jonathan Borba: Hands massaging bare upper back
  "https://images.pexels.com/photos/29821658/pexels-photo-29821658.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 29821658, Larysa Stratiichuk: Therapist working lower back, towel
  "https://images.pexels.com/photos/6628649/pexels-photo-6628649.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628649, KoolShooters: Back massage by bright window
  "https://images.pexels.com/photos/6187847/pexels-photo-6187847.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6187847, Tima Miroshnichenko: Oiled hands with wooden tool
  "https://images.pexels.com/photos/5240643/pexels-photo-5240643.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5240643, Anete Lusina: Back massage with fairy lights
  "https://images.pexels.com/photos/37719536/pexels-photo-37719536.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 37719536, Ian Panelo: Thai style massage outdoors
  "https://images.pexels.com/photos/37719545/pexels-photo-37719545.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 37719545, Ian Panelo: Shoulder massage for male client
  "https://images.pexels.com/photos/6628701/pexels-photo-6628701.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628701, KoolShooters: Top view, hands on back
  "https://images.pexels.com/photos/4599377/pexels-photo-4599377.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 4599377, Anthony Shkraba: Therapist massaging client on table
  "https://images.pexels.com/photos/9146372/pexels-photo-9146372.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9146372, Ron Lach: Neck massage in dim room
  "https://images.pexels.com/photos/38407788/pexels-photo-38407788.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 38407788, @tommaso: Back massage with white towel
  "https://images.pexels.com/photos/6628646/pexels-photo-6628646.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628646, KoolShooters: Close-up shoulder blade massage
  "https://images.pexels.com/photos/19641817/pexels-photo-19641817.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 19641817, Jonathan Borba: Hands massaging dark-skinned back
  "https://images.pexels.com/photos/5888099/pexels-photo-5888099.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5888099, Gustavo Fring: Back massage beside towel shelves
  "https://images.pexels.com/photos/18120174/pexels-photo-18120174.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 18120174, Halosa Sapa: Two therapists, Thai leg stretches
  "https://images.pexels.com/photos/19388385/pexels-photo-19388385.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 19388385, Alexandru Cojanu: Back massage, dark background
  "https://images.pexels.com/photos/9146381/pexels-photo-9146381.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9146381, Ron Lach: Foot massage in marble room
  "https://images.pexels.com/photos/7598363/pexels-photo-7598363.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7598363, Max Vakhtbovych: Wooden sauna room with bench
  "https://images.pexels.com/photos/7031704/pexels-photo-7031704.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7031704, Max Vakhtbovych: Spa lounge with heated loungers
  "https://images.pexels.com/photos/4170175/pexels-photo-4170175.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 4170175, Engin Akyurt: Massage table in white room
  "https://images.pexels.com/photos/16151060/pexels-photo-16151060.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 16151060, @jessejames: Two massage beds, round lamp
  "https://images.pexels.com/photos/6629530/pexels-photo-6629530.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6629530, Karola G: Hot stones placed on back
  "https://images.pexels.com/photos/6560295/pexels-photo-6560295.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560295, Anna Tarazevich: Hot stone on shoulder, close-up
  "https://images.pexels.com/photos/6187657/pexels-photo-6187657.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6187657, Tima Miroshnichenko: Top view, stones along spine
  "https://images.pexels.com/photos/9483565/pexels-photo-9483565.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9483565, Leomara Paiva: Green stones and massaging hands
  "https://images.pexels.com/photos/6187652/pexels-photo-6187652.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6187652, Tima Miroshnichenko: Therapist arranging hot stones
  "https://images.pexels.com/photos/36593691/pexels-photo-36593691.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 36593691, Rita Bepita: Hands working with hot stones
  "https://images.pexels.com/photos/6187641/pexels-photo-6187641.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6187641, Tima Miroshnichenko: Stones on spine, dim light
  "https://images.pexels.com/photos/6560298/pexels-photo-6560298.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560298, Anna Tarazevich: Stone massage on bright table
  "https://images.pexels.com/photos/5240634/pexels-photo-5240634.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5240634, Anete Lusina: Hot stone along tattooed spine
  "https://images.pexels.com/photos/5378218/pexels-photo-5378218.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5378218, Engin Akyurt: Stones on back with orchids
  "https://images.pexels.com/photos/5240636/pexels-photo-5240636.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5240636, Anete Lusina: Three hot stones, warm lights
  "https://images.pexels.com/photos/9898724/pexels-photo-9898724.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9898724, @ekaterinamitkina: Therapist placing stones, green towel
  "https://images.pexels.com/photos/37109075/pexels-photo-37109075.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 37109075, Iram Shehzad: Hands between hot stones
  "https://images.pexels.com/photos/6560273/pexels-photo-6560273.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560273, Anna Tarazevich: Top view stones, wooden room
  "https://images.pexels.com/photos/6628606/pexels-photo-6628606.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628606, KoolShooters: Therapist holding massage oil
  "https://images.pexels.com/photos/6628485/pexels-photo-6628485.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628485, KoolShooters: Oil bottle and wooden roller
  "https://images.pexels.com/photos/28321583/pexels-photo-28321583.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 28321583, unknown: Pouring oil into palm
  "https://images.pexels.com/photos/37719647/pexels-photo-37719647.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 37719647, Ian Panelo: Firm shoulder massage, close-up
  "https://images.pexels.com/photos/38407790/pexels-photo-38407790.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 38407790, @tommaso: Kneading shoulders, soft light
  "https://images.pexels.com/photos/6629610/pexels-photo-6629610.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6629610, Karola G: Back massage by candlelight
  "https://images.pexels.com/photos/19641816/pexels-photo-19641816.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 19641816, Jonathan Borba: Warm oil poured into hands
  "https://images.pexels.com/photos/6628696/pexels-photo-6628696.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628696, KoolShooters: Oil bottle over relaxed back
  "https://images.pexels.com/photos/20421576/pexels-photo-20421576.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 20421576, Alina Zahorulko: Oiled leg massage, warm light
  "https://images.pexels.com/photos/6628474/pexels-photo-6628474.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628474, KoolShooters: Oil bottles and wooden massager
  "https://images.pexels.com/photos/6560283/pexels-photo-6560283.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560283, Anna Tarazevich: Pump bottle of massage oil
  "https://images.pexels.com/photos/6188050/pexels-photo-6188050.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6188050, Tima Miroshnichenko: Stacked towels and candle lamp
  "https://images.pexels.com/photos/5833316/pexels-photo-5833316.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5833316, @analogicus: Rolled white and yellow towels
  "https://images.pexels.com/photos/4177714/pexels-photo-4177714.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 4177714, Engin Akyurt: White towels in woven basket
  "https://images.pexels.com/photos/21661433/pexels-photo-21661433.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 21661433, Dmitriy Steinke: Towels on wooden tray
  "https://images.pexels.com/photos/3610006/pexels-photo-3610006.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 3610006, @castorlystock: Rolled towels on bath rack
  "https://images.pexels.com/photos/6127451/pexels-photo-6127451.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6127451, Rachel Claire: Rolled towels with green plants
  "https://images.pexels.com/photos/20523089/pexels-photo-20523089.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 20523089, @laurencuddy: Shelves of rolled towels
  "https://images.pexels.com/photos/7691101/pexels-photo-7691101.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7691101, Roman Odintsov: Stack of soft white towels
  "https://images.pexels.com/photos/4210314/pexels-photo-4210314.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 4210314, Karola G: Linen towels and potted plant
  "https://images.pexels.com/photos/17428224/pexels-photo-17428224.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 17428224, Dmitriy Steinke: Rolled towels in macrame chair
  "https://images.pexels.com/photos/29962514/pexels-photo-29962514.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 29962514, @valeriya: Spa shelves with rolled towels
  "https://images.pexels.com/photos/2672634/pexels-photo-2672634.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 2672634, Engin Akyurt: Rolled grey towel, close-up
  "https://images.pexels.com/photos/9146378/pexels-photo-9146378.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9146378, Ron Lach: Massage in dark modern spa
  "https://images.pexels.com/photos/36837604/pexels-photo-36837604.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 36837604, @aiseleer: Calm treatment room, paper lamp
  "https://images.pexels.com/photos/3881006/pexels-photo-3881006.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 3881006, Andrea Piacquadio: Massage in curtained treatment room
  "https://images.pexels.com/photos/6186738/pexels-photo-6186738.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6186738, Tima Miroshnichenko: Thai therapist giving back massage
  "https://images.pexels.com/photos/11774389/pexels-photo-11774389.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 11774389, Tugce Erten Barrett: Arched room with massage bed
  "https://images.pexels.com/photos/6188043/pexels-photo-6188043.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6188043, Tima Miroshnichenko: Massage beside velvet curtains
  "https://images.pexels.com/photos/6628520/pexels-photo-6628520.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628520, KoolShooters: Empty massage table by window
  "https://images.pexels.com/photos/7789646/pexels-photo-7789646.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7789646, @babydov: Massage table, lit leaf panel
  "https://images.pexels.com/photos/6560308/pexels-photo-6560308.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560308, Anna Tarazevich: Massage table near wooden blinds
  "https://images.pexels.com/photos/6560274/pexels-photo-6560274.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560274, Anna Tarazevich: Hot stone treatment by window
  "https://images.pexels.com/photos/6628599/pexels-photo-6628599.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628599, KoolShooters: Therapist massaging in loft room
  "https://images.pexels.com/photos/3865792/pexels-photo-3865792.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 3865792, Elly Fairytale: Back massage with lit candles
  "https://images.pexels.com/photos/6188042/pexels-photo-6188042.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6188042, Tima Miroshnichenko: Thai massage on floor mat
  "https://images.pexels.com/photos/14254022/pexels-photo-14254022.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 14254022, @dreamcatchlight: Thai stretch on floor mattress
  "https://images.pexels.com/photos/34821383/pexels-photo-34821383.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 34821383, @petemiller: Thai massage on blue mat
  "https://images.pexels.com/photos/35176574/pexels-photo-35176574.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 35176574, @petemiller: Thai wooden tool on shoulder
  "https://images.pexels.com/photos/34927635/pexels-photo-34927635.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 34927635, @petemiller: Leg massage on blue mat
  "https://images.pexels.com/photos/6188032/pexels-photo-6188032.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6188032, Tima Miroshnichenko: Foot massage close-up, warm
  "https://images.pexels.com/photos/6186753/pexels-photo-6186753.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6186753, Tima Miroshnichenko: Top view of Thai massage
  "https://images.pexels.com/photos/6187421/pexels-photo-6187421.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6187421, Tima Miroshnichenko: Herbal compress on back
  "https://images.pexels.com/photos/15949782/pexels-photo-15949782.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 15949782, @dashamak: Foot bath with rose petals
  "https://images.pexels.com/photos/17661224/pexels-photo-17661224.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 17661224, Darya Grey owl: Candle with dried lavender
  "https://images.pexels.com/photos/9898719/pexels-photo-9898719.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9898719, @ekaterinamitkina: Oil bottles on green moss
  "https://images.pexels.com/photos/7795650/pexels-photo-7795650.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7795650, @alesiakozik: Reed diffuser and soft linen
  "https://images.pexels.com/photos/17661200/pexels-photo-17661200.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 17661200, Darya Grey owl: Bottle, lavender and pillar candle
  "https://images.pexels.com/photos/19695948/pexels-photo-19695948.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 19695948, Jonathan Borba: Feet soaking in bath salts
  "https://images.pexels.com/photos/6914655/pexels-photo-6914655.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6914655, Eva Bronzini: Essential oil diffuser, close-up
  "https://images.pexels.com/photos/9344966/pexels-photo-9344966.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9344966, @johndetochka: Bath tray with candle, flowers
  "https://images.pexels.com/photos/208504/pexels-photo-208504.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 208504, Pixabay: Towels, incense and frangipani
  "https://images.pexels.com/photos/9898734/pexels-photo-9898734.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9898734, @ekaterinamitkina: Candle, oil bottles, lavender
  "https://images.pexels.com/photos/6620855/pexels-photo-6620855.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6620855, Gabby K: Tray of spa products
  "https://images.pexels.com/photos/1926811/pexels-photo-1926811.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 1926811, Aan Amrin: Candles, towels and frangipani
  "https://images.pexels.com/photos/6186740/pexels-photo-6186740.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6186740, Tima Miroshnichenko: Oil burner with rolled towels
  "https://images.pexels.com/photos/20431481/pexels-photo-20431481.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 20431481, Gabby K: Oil drops in flower bowl
  "https://images.pexels.com/photos/5888078/pexels-photo-5888078.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5888078, Gustavo Fring: Four-hand massage, two therapists
  "https://images.pexels.com/photos/1123256/pexels-photo-1123256.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 1123256, @valeriya: Lit pillar candles on tray
  "https://images.pexels.com/photos/6311869/pexels-photo-6311869.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6311869, Ekaterina Bolovtsova: Two candles with rosemary
  "https://images.pexels.com/photos/34478574/pexels-photo-34478574.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 34478574, James Ton: Candles, citrus and rolled towel
  "https://images.pexels.com/photos/3654619/pexels-photo-3654619.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 3654619, @castorlystock: Candle on wooden bath tray
  "https://images.pexels.com/photos/11137699/pexels-photo-11137699.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 11137699, Andrzej Gdula: Candles and dried petals tray
  "https://images.pexels.com/photos/30428755/pexels-photo-30428755.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 30428755, Suki Lee: Floating lotus tea lights
  "https://images.pexels.com/photos/7303331/pexels-photo-7303331.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7303331, Cup Of Couple: Tea lights with rose petals
  "https://images.pexels.com/photos/6205896/pexels-photo-6205896.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6205896, Roman Odintsov: Candles with sage bundles
  "https://images.pexels.com/photos/5793708/pexels-photo-5793708.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5793708, Yan Krukov: Seated head and neck massage
  "https://images.pexels.com/photos/7233272/pexels-photo-7233272.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7233272, cottonbro studio: Therapist at bright window table
  "https://images.pexels.com/photos/6628475/pexels-photo-6628475.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628475, KoolShooters: Massage table face cradle
  "https://images.pexels.com/photos/5888132/pexels-photo-5888132.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5888132, Gustavo Fring: Male client, blue massage table
  "https://images.pexels.com/photos/8313244/pexels-photo-8313244.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 8313244, RDNE Stock project: Therapist treating clothed client
  "https://images.pexels.com/photos/11581438/pexels-photo-11581438.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 11581438, Anvar Tushakov: Back massage in bright room
  "https://images.pexels.com/photos/8789646/pexels-photo-8789646.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 8789646, Darina Belonogova: Flower on balanced stones
  "https://images.pexels.com/photos/7352015/pexels-photo-7352015.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7352015, Lidia Bekenova: Three stacked stones, grey
  "https://images.pexels.com/photos/6468678/pexels-photo-6468678.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6468678, Eva Bronzini: Smooth pebbles and lava stones
  "https://images.pexels.com/photos/8789583/pexels-photo-8789583.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 8789583, Darina Belonogova: Pillar candle with stones
  "https://images.pexels.com/photos/6560285/pexels-photo-6560285.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6560285, Anna Tarazevich: Basalt stones with star anise
  "https://images.pexels.com/photos/7814723/pexels-photo-7814723.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7814723, Mikhail Nilov: Stone stack with green sprout
  "https://images.pexels.com/photos/29685436/pexels-photo-29685436.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 29685436, Karsten Sporenberg: Balanced stone cairn, white
  "https://images.pexels.com/photos/6187648/pexels-photo-6187648.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6187648, Tima Miroshnichenko: Black massage stones on linen
  "https://images.pexels.com/photos/7175346/pexels-photo-7175346.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 7175346, Marta Dzedyshko: Stacked stones and bath bomb
  "https://images.pexels.com/photos/28988951/pexels-photo-28988951.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 28988951, Nastia Ligrain: Natural soap with pebbles
  "https://images.pexels.com/photos/6693968/pexels-photo-6693968.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6693968, Tara Winstead: Oil bottle among white pebbles
  "https://images.pexels.com/photos/5240641/pexels-photo-5240641.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5240641, Anete Lusina: Therapist giving foot massage
  "https://images.pexels.com/photos/5793925/pexels-photo-5793925.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5793925, Yan Krukov: Feet held during reflexology
  "https://images.pexels.com/photos/19695964/pexels-photo-19695964.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 19695964, Jonathan Borba: Foot massage in warm light
  "https://images.pexels.com/photos/9483564/pexels-photo-9483564.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 9483564, Leomara Paiva: Thumb pressure on foot sole
  "https://images.pexels.com/photos/6628700/pexels-photo-6628700.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 6628700, KoolShooters: Foot massage on table
  "https://images.pexels.com/photos/5793892/pexels-photo-5793892.jpeg?auto=compress&cs=tinysrgb&w=800", // pexels 5793892, Yan Krukov: Foot massage, client lying down
  "https://images.unsplash.com/photo-1761470575018-135c213340eb?w=800&q=70&auto=format&fit=crop", // unsplash photo-1761470575018-135c213340eb, Dominik Neuner: Steam room with glowing candle
  "https://images.unsplash.com/photo-1773924093206-9a433a14bb44?w=800&q=70&auto=format&fit=crop", // unsplash photo-1773924093206-9a433a14bb44, Virginia Marinova: Relaxation lounge with loungers
  "https://images.unsplash.com/photo-1757940113920-69e3686438d3?w=800&q=70&auto=format&fit=crop", // unsplash photo-1757940113920-69e3686438d3, Auroom Wellness: Sauna with curved wooden loungers
  "https://images.unsplash.com/photo-1630835425197-50feeba99ecd?w=800&q=70&auto=format&fit=crop", // unsplash photo-1630835425197-50feeba99ecd, Cherosi: Cozy massage room with blinds
  "https://images.unsplash.com/photo-1583416750470-965b2707b355?w=800&q=70&auto=format&fit=crop", // unsplash photo-1583416750470-965b2707b355, HUUM: Calm sauna with wooden benches
];

/** The same photo at another width (both CDNs resize on the `w` parameter). */
export function sizedPhoto(url: string, width: number): string {
  if (!/^https:\/\/images\.(pexels|unsplash)\.com\//.test(url)) return url;
  return url.replace(/([?&])w=\d+/, `$1w=${Math.round(width)}`);
}

/** FNV-1a with an avalanche mix: a stable, well spread number for an id. */
export function hashId(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface StockSlotInput {
  id: string;
  /** partners.created_at; older studios are placed first. */
  createdAt?: string | null;
  /** Has at least one service, so it shows on /studios, the map and /compare. */
  listed: boolean;
}

/**
 * Give every studio its own stock photo (an index into STOCK_PHOTOS).
 *
 * 1. Order: listed studios first, then the rest; inside each group the
 *    oldest first (created_at, then id). The order of the input is ignored.
 * 2. Each studio starts at slot hashId(id) mod n and takes the next free
 *    slot. While there are at most n studios no two share a photo, and a
 *    listed studio never shares while there are at most n listed studios.
 * 3. A new studio comes last in its group and takes a free slot, so every
 *    listed studio keeps its photo when a studio joins (only an unlisted one
 *    can move, when a new listed studio takes its slot).
 * 4. Past n studios, the extra ones (always the newest unlisted ones while
 *    there are at most n listed) reuse, in turn, the photos held by unlisted
 *    studios, so the photos people see on /studios stay unique. No photo is
 *    used more than twice while (all studios + listed studios) <= 2n.
 *
 * 7 Nov 2026: 167 studios, 62 listed. All 62 listed photos are unique (no
 * other studio has them); 38 photos are each used by two unlisted studios,
 * whose photo only ever shows on their own studio page.
 */
export function assignStockSlots(rows: StockSlotInput[], n: number = STOCK_PHOTOS.length): Map<string, number> {
  const out = new Map<string, number>();
  if (n <= 0) return out;
  const unique = new Map<string, StockSlotInput>();
  for (const r of rows) if (r?.id && !unique.has(r.id)) unique.set(r.id, r);
  const order = [...unique.values()]
    .sort((a, b) => {
      if (a.listed !== b.listed) return a.listed ? -1 : 1;
      const ca = a.createdAt ?? "";
      const cb = b.createdAt ?? "";
      if (ca !== cb) return ca < cb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const owner: (StockSlotInput | null)[] = new Array(n).fill(null);
  let used = 0;
  const overflow: StockSlotInput[] = [];
  for (const r of order) {
    if (used >= n) {
      overflow.push(r);
      continue;
    }
    let slot = hashId(r.id) % n;
    while (owner[slot]) slot = (slot + 1) % n;
    owner[slot] = r;
    used++;
    out.set(r.id, slot);
  }
  if (overflow.length) {
    const unlistedSlots = owner.flatMap((o, i) => (o && !o.listed ? [i] : []));
    const share = unlistedSlots.length ? unlistedSlots : owner.map((_, i) => i);
    // In turn (oldest first), so a photo is reused as few times as possible.
    overflow.forEach((r, k) => out.set(r.id, share[k % share.length]));
  }
  return out;
}
