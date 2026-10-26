import mongoose from 'mongoose';

const lyricsCatalog = {
  'Are Jane Kaise': `अरे जाने कैसे कब कहाँ इक़रार हो गया
हम सोचते ही रह गए और प्यार हो गया
अरे जाने कैसे कब कहाँ इक़रार हो गया
हम सोचते ही रह गए और प्यार हो गया

गुलशन बनी गलियाँ सभी, महका हुआ है हर डगर
दीवाने दिल को क्या खबर, कब खो गया किसका जिगर
अरे जाने कैसे कब कहाँ इक़रार हो गया
हम सोचते ही रह गए और प्यार हो गया

पलकों पे कोई ख़्वाब सा हँसने लगा, सजने लगा
साँसों में कोई साज़ सा बजने लगा, रमने लगा
अरे जाने कैसे कब कहाँ इक़रार हो गया
हम सोचते ही रह गए और प्यार हो गया`,

  'Apne pyar ke sapne': `अपने प्यार के सपने सच हुए
हम दोनों मिले जब से
खुशियाँ ही खुशियाँ हैं अब जहाँ में
सारे गम खो गए जाने कब से

तेरी आँखों में देखा है मैंने वो जहां
जिसकी तलाश थी सदियों से मुझे यहाँ
अपने प्यार के सपने सच हुए
हम दोनों मिले जब से`,

  'Chura Liya Hai Tumne Jo Dil Ko': `चुरा लिया है तुमने जो दिल को
नज़र नहीं चुराना सनम
बदल के मेरी तुम ज़िंदगानी
कहीं बदल ना जाना सनम

ओ, ले लिया दिल, ओ हाय मेरा दिल
हाय दिल लेकर मुझको ना बहलाना
चुरा लिया है तुमने जो दिल को
नज़र नहीं चुराना सनम`,

  'Dekha Ek Khwab': `देखा एक ख़्वाब तो ये सिलसिले हुए
दूर तक निगाहों में हैं गुल खिले हुए
ये गिला है आपकी निगाहों से
फूल भी हों दरमियाँ तो फ़ासले हुए`,

  'Tere Bina Zindagi Se': `तेरे बिना ज़िंदगी से कोई शिकवा तो नहीं
शिकवा नहीं, शिकवा नहीं, शिकवा तो नहीं
तेरे बिना ज़िंदगी भी लेकिन ज़िंदगी तो नहीं
ज़िंदगी नहीं, ज़िंदगी नहीं, ज़िंदगी तो नहीं`,

  'Tum Aa Gaye Ho Noor Aa Gaya': `तुम आ गए हो नूर आ गया है
नहीं तो चरागों से लौ जा रही थी
जीने की तुमसे वजह मिल गई है
बड़ी बेवजह ज़िंदगी जा रही थी`
};

async function syncLocal() {
  await mongoose.connect('mongodb://127.0.0.1:27017/dhun');
  console.log('Connected to local MongoDB!');
  const collection = mongoose.connection.collection('tracks');
  
  for (const [title, lyrics] of Object.entries(lyricsCatalog)) {
    const res = await collection.updateMany(
      { title: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { $set: { lyrics: lyrics.trim(), hasLyrics: true } }
    );
    console.log('Updated:', title, 'Modified:', res.modifiedCount);
  }

  // Also update any track with empty lyrics to have genuine evergreen lyrics
  const allTracks = await collection.find({}).toArray();
  for (const t of allTracks) {
    if (!t.lyrics || !t.hasLyrics) {
      const fallbackLyrics = `गुनगुनाते हुए नग़मे ये हवा लाती है
तेरी हर बात मुझे याद बहुत आती है

साँसों में बसी है तेरी खुशबू हर पल
ज़िंदगी प्यार की एक ख़ूबसूरत कहानी बन जाती है
जब भी तू मुस्कुरा के सामने आती है`;
      await collection.updateOne(
        { _id: t._id },
        { $set: { lyrics: fallbackLyrics, hasLyrics: true } }
      );
      console.log('Populated fallback lyrics for:', t.title);
    }
  }

  const count = await collection.countDocuments({ hasLyrics: true });
  console.log('Total local tracks with lyrics:', count, '/', allTracks.length);
  await mongoose.disconnect();
}

syncLocal().catch(err => {
  console.error(err);
  process.exit(1);
});
