// 訂位須知 (booking notes per program), 2026-10-15: how each program books (online or by phone, partner quirks), the
// surcharges and fees it passes on, its change and cancel rules, and a few tips for someone booking from Taiwan or
// Seattle. Every sentence was researched from the program's own pages and 2025-2026 sources, then checked against a
// second source by an independent fact-checker; claims nobody could confirm were left out. Rules change often, so
// the page says when it was checked and links the sources.
// A page of its own (#/notes, under 我的; #/notes?k=<program> opens one), and a short block in each card's details.
(() => {
  const NOTES = /*NOTES_DATA*/{
   "as_of": "2026-10-15",
   "programs": {
    "aeromexico": {
     "book": {
      "zh": "墨西哥航空自家航班可以線上訂，部分 SkyTeam 夥伴的行程也查得到。查不到就帶著確切航班打電話訂，建議 SkyTeam 夥伴航班至少在出發前 7 個工作天打（墨西哥航空航班 24 小時前）。動態計價的 Dynamic 獎勵票只限墨西哥航空、達美航空、荷蘭皇家航空和法國航空，固定價格的 Classic 獎勵票還涵蓋其他 SkyTeam 夥伴。",
      "en": "Aeromexico flights book online, and some SkyTeam partner itineraries show online too. If yours doesn't, call with the exact flights, ideally at least 7 working days before departure for SkyTeam partners (24 hours for Aeromexico flights). Dynamic-priced awards cover only Aeromexico, Delta, KLM and Air France, while fixed-price Classic awards also cover other SkyTeam partners."
     },
     "fees": {
      "zh": "Aeromexico 會把航空公司附加費轉嫁到獎勵票上。另外還要付現金開票手續費：網站訂 MX$323，電話等其他管道訂 MX$640。",
      "en": "Aeromexico passes on carrier-imposed surcharges on awards. It also adds a cash booking fee of MX$323 online, or MX$640 through any other channel such as the phone."
     },
     "changes": {
      "zh": "改票和退票都要打客服電話。改票費從國內線 MX$700 到國際線 MX$5,400（往返美國 MX$4,000），退票國內線 MX$1,930、國際線 MX$2,900，開票手續費不退。開票後不能改航線、姓名或艙等；墨西哥航空自營的 Dynamic 獎勵票如果票種允許退票，過了 24 小時仍可以退，費用一樣是 MX$1,930 或 MX$2,900。",
      "en": "Changes and cancellations go through the call center. A change costs from MX$700 domestic to MX$5,400 international (MX$4,000 to or from the US), cancelling costs MX$1,930 domestic or MX$2,900 international, and the booking fee is not refunded. Route, name and cabin can't be changed after ticketing, but Dynamic awards on Aeromexico flights whose fare allows refunds can still be refunded after 24 hours for the same MX$1,930 or MX$2,900."
     },
     "tips": [
      {
       "zh": "西雅圖和加拿大、紐約、波士頓、芝加哥同屬一個獎勵票區域，跟美國其他城市分開計價。",
       "en": "Seattle sits in its own award zone with Canada, New York, Boston and Chicago, priced separately from other US cities."
      },
      {
       "zh": "來回獎勵票可以有一次超過 24 小時的停留，但起點到終點之間最多轉機兩次。",
       "en": "A round-trip award allows one stopover of more than 24 hours, with no more than two connections between origin and destination."
      },
      {
       "zh": "Citi ThankYou 從 2026 年 1 月 25 日起不能再轉 Aeromexico；Amex 還可以轉，1,000 點換 1,600 點。",
       "en": "Citi ThankYou stopped transferring to Aeromexico on January 25, 2026; Amex still transfers 1,000 points to 1,600 Aeromexico points."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20250704155607/https://www.aeromexicorewards.com/mx/terminos-y-condiciones-boleto-premio/",
       "title": "Aeromexico Rewards: award terms (archived)",
       "date": "2025-07-04"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/best-ways-to-redeem-aeromexico-club-premier-points/",
       "title": "Upgraded Points",
       "date": "2026-02-02"
      },
      {
       "url": "https://onemileatatime.com/deals/amex-aeromexico-transfer-bonus/",
       "title": "One Mile at a Time",
       "date": "2026-10-01"
      },
      {
       "url": "https://awardwallet.com/airlines/award-ticket-change-and-cancellation-policies/",
       "title": "AwardWallet: change and cancel fees",
       "date": "2026-10-04"
      },
      {
       "url": "https://frequentmiler.com/award-ticket-change-and-cancellation-fees-by-transfer-partner/",
       "title": "Frequent Miler: change and cancel fees",
       "date": "2026-07-24"
      },
      {
       "url": "https://www.doctorofcredit.com/citi-to-remove-aeromexico-as-transfer-partner-on-1-25-26/",
       "title": "Doctor of Credit",
       "date": "2026-01-20"
      }
     ]
    },
    "aeroplan": {
     "book": {
      "zh": "加拿大航空和合作夥伴的獎勵票都能在 aircanada.com 或 Air Canada App 免費訂，大部分夥伴都能線上訂，複雜的行程可能要打電話。打電話訂收 CA$30，就算是網站訂不了才打也照收。獎勵票要馬上開票（不能保留），共用班號（codeshare）的航班不能訂。",
      "en": "Air Canada and partner awards book free at aircanada.com or in the Air Canada app; most partners show online, but complex trips may need a call. Booking by phone costs CA$30, even when the trip couldn't be booked online. Awards must be ticketed right away (no holds), and codeshare flights aren't eligible."
     },
     "fees": {
      "zh": "加拿大航空和合作夥伴的航班都不收燃油附加費。只要票裡有夥伴航班，每張票收 CA$39 的夥伴訂位費；有些行程另外加收 US Tax Recovery Fee。",
      "en": "No fuel surcharges on Air Canada or partner flights. Every award ticket that includes a partner flight pays a CA$39 partner booking fee, and some itineraries add a US Tax Recovery Fee."
     },
     "changes": {
      "zh": "經濟艙 Standard 和高艙等 Lowest 的獎勵票，線上改票每個方向 CA$75（電話 CA$100），線上取消每張 CA$150（電話 CA$175）；經濟艙 Flex 改票免費、線上取消 CA$75，Latitude 和 Flexible 都不收費。訂位後 24 小時內取消免費，符合資格的菁英會員可能免收手續費。改票或取消至少要在起飛前 2 小時辦好，不然整張票作廢。",
      "en": "Standard economy and Lowest premium-cabin awards cost CA$75 per direction to change online (CA$100 by phone) and CA$150 per ticket to cancel online (CA$175 by phone); Economy Flex changes are free and its cancellations cost CA$75 online, and Latitude and Flexible awards carry no fees. Cancelling within 24 hours of booking is free, and eligible elite members may have fees waived. Any change or cancellation must be made at least 2 hours before departure, or the ticket is forfeited."
     },
     "tips": [
      {
       "zh": "中途停留（stopover）每個方向可以一次，最長 45 天，加 5,000 點，單程票也可以；但不能停在加拿大、美國或中國。",
       "en": "A stopover of up to 45 days costs 5,000 extra points, one per direction (one-way awards included), but it can't be in Canada, the US or China."
      },
      {
       "zh": "北美到太平洋地區的商務艙，飛行 5,001 到 7,500 哩、搭長榮航空這類固定價格夥伴要 85,000 點（2026-06-01 前是 75,000）；United 從 2025-03-25 起和加拿大航空一樣用浮動價格，起價 85,000，中位數 158,200。點數照實際飛行距離算，SEA-TPE 直飛約 6,060 哩，轉機繞太遠可能跳到下一級（102,500）。",
       "en": "Business between North America and the Pacific costs 85,000 points for 5,001 to 7,500 miles flown on fixed-price partners such as EVA (75,000 before 2026-06-01); United has been priced like Air Canada on the variable chart since 2025-03-25, starting at 85,000 with a 158,200 median. Points follow the distance actually flown, and nonstop SEA-TPE is about 6,060 miles, so a long connection can push the price into the next band (102,500)."
      },
      {
       "zh": "最多 8 位家人可以免費合併點數（Family Sharing）。要入會滿 6 個月才能開，加入的人至少要待 3 個月。",
       "en": "Up to 8 family members can pool points for free (Family Sharing). You need 6 months of membership to start a pool, and members must stay in for at least 3 months."
      }
     ],
     "sources": [
      {
       "url": "https://www.aircanada.com/ca/en/aco/home/aeroplan/legal/aeroplan-flight-reward-policy.html",
       "title": "Aeroplan: Flight Reward Policy"
      },
      {
       "url": "https://www.aircanada.com/ca/en/aco/home/aeroplan/redeem/air-canada.html",
       "title": "Aeroplan: redeem points"
      },
      {
       "url": "https://www.aircanada.com/content/dam/aircanada/loyalty-content/documents/flight-rewards-chart-june2026-en.pdf",
       "title": "Aeroplan: reward chart (PDF)",
       "date": "2026-08"
      },
      {
       "url": "https://www.aircanada.com/ca/en/aco/home/aeroplan/news/2026-an-update-on-the-aeroplan-flight-reward-chart.html",
       "title": "Aeroplan: 2026 chart update"
      },
      {
       "url": "https://www.aircanada.com/ca/en/aco/home/aeroplan/family-sharing.html",
       "title": "Aeroplan: Family Sharing"
      },
      {
       "url": "https://thepointsguy.com/loyalty-programs/air-canada-aeroplan/",
       "title": "The Points Guy: Aeroplan guide",
       "date": "2026-09-14"
      }
     ]
    },
    "alaska": {
     "book": {
      "zh": "alaskaair.com 可以線上訂阿拉斯加航空、夏威夷航空和大部分夥伴，包括星宇航空、國泰航空、日本航空、大韓航空和菲律賓航空；網路上查不到的位子，可以打客服 1-800-252-7522 訂。大部分單程獎勵票只能讓阿拉斯加航空或夏威夷航空搭配一家夥伴，要混搭多家夥伴只限美國航空、英國航空和芬蘭航空。起點和終點都在美國以外的獎勵票，至少要在起飛前 72 小時訂。",
      "en": "alaskaair.com books Alaska, Hawaiian and most partners online, including STARLUX, Cathay Pacific, JAL, Korean Air and Philippine Airlines; award space that doesn't show online can be booked through the call center at 1-800-252-7522. Most one-way awards can pair Alaska or Hawaiian with only one partner, and mixing partners works only among American, British Airways and Finnair. Awards that start and end outside the US must be booked at least 72 hours before departure."
     },
     "fees": {
      "zh": "阿拉斯加航空自家航班只收基本稅金。夥伴獎勵票每人每個單程另收 US$20，不能退（2026 年 7 月 1 日起開的票適用，之前是 US$12.50）；持 Atmos Rewards Summit 卡、並用這張卡付稅費的話免收。打電話訂位加收 US$30 客服費，Atmos Gold 和 Platinum 會員免收。",
      "en": "Alaska's own flights carry only basic taxes. Each partner award adds a nonrefundable US$20 per person each way (for tickets issued from July 1, 2026; it was US$12.50 before), waived for Atmos Rewards Summit cardholders who pay the taxes and fees with that card. Booking by phone adds a US$30 call center fee, free for Atmos Gold and Platinum members."
     },
     "changes": {
      "zh": "改票、取消或把點數退回帳戶都免費，改夥伴行程也不會再收一次 US$20。取消時稅金會退，但 US$20 夥伴手續費和電話客服費不退。一定要在起飛前改或取消，不然整張票作廢。",
      "en": "Changing, canceling or redepositing an award is free, and changing a partner itinerary doesn't charge the US$20 fee again. When you cancel, taxes are refunded but the US$20 partner fee and any call center fee are not. Change or cancel before the flight departs, or the ticket is forfeited."
     },
     "tips": [
      {
       "zh": "星宇航空美國航線的商務艙 75,000 點起，是 Atmos 亞太區獎勵表 5,001 到 7,000 哩那一級的價格。",
       "en": "STARLUX business class to or from the US starts at 75,000 points, the price for 5,001 to 7,000 miles on the Atmos Asia Pacific chart."
      },
      {
       "zh": "符合資格的國際線獎勵票，每個單程可以中停一次、最多 14 天，所以搭星宇航空去東南亞，可以免費在台北停留。",
       "en": "Eligible international awards allow one stopover of up to 14 days per one-way, so a STARLUX trip to Southeast Asia can include a free stop in Taipei."
      },
      {
       "zh": "Amex、Chase、Citi 和 Capital One 的點數都不能轉進 Atmos，能轉的只有 Bilt（1:1）和 Marriott Bonvoy（3:1）。",
       "en": "Amex, Chase, Citi and Capital One points don't transfer to Atmos; the ways in are Bilt (1:1) and Marriott Bonvoy (3:1)."
      }
     ],
     "sources": [
      {
       "url": "https://www.alaskaair.com/atmosrewards/content/faq/redeeming",
       "title": "Atmos Rewards: redeeming FAQ",
       "date": "2026-09-19"
      },
      {
       "url": "https://www.alaskaair.com/atmosrewards/content/use-points/award-charts",
       "title": "Atmos Rewards: award charts"
      },
      {
       "url": "https://www.alaskaair.com/content/travel-info/optional-services-fees",
       "title": "Alaska: optional service fees",
       "date": "2026-09-19"
      },
      {
       "url": "https://www.alaskaair.com/atmosrewards/content/partners/airlines/starlux",
       "title": "Atmos Rewards: STARLUX"
      },
      {
       "url": "https://onemileatatime.com/news/redeem-alaska-points-starlux/",
       "title": "One Mile at a Time",
       "date": "2026-07-15"
      },
      {
       "url": "https://frequentmiler.com/alaska-atmos-rewards-complete-guide/",
       "title": "Frequent Miler",
       "date": "2026-10-12"
      }
     ]
    },
    "american": {
     "book": {
      "zh": "aa.com 和美國航空 App 可以線上訂美國航空和大部分夥伴，包括阿拉斯加航空、夏威夷航空、國泰航空、日本航空、卡達航空、澳洲航空、馬來西亞航空、英國航空、西班牙國家航空、芬蘭航空、斐濟航空和阿提哈德航空。中國南方航空的獎勵票要打電話訂；美國航空的新共享班號夥伴星宇航空，目前還不能用 AAdvantage 哩程訂。",
      "en": "aa.com and the American app book American and most partners online, including Alaska, Hawaiian, Cathay Pacific, JAL, Qatar, Qantas, Malaysia Airlines, British Airways, Iberia, Finnair, Fiji Airways and Etihad. China Southern awards need a phone call, and STARLUX, American's new codeshare partner, can't be booked with AAdvantage miles yet."
     },
     "fees": {
      "zh": "只有英國航空和西班牙國家航空會轉嫁燃油附加費，取消的話這筆錢會退；美國航空自家航班和國泰航空、日本航空、卡達航空、澳洲航空等夥伴都不收。臨近出發才訂不加收費用，打電話訂獎勵票也不收手續費。",
      "en": "Fuel surcharges are passed on only on British Airways and Iberia, and that charge is refunded if you cancel; American's own flights and partners such as Cathay Pacific, JAL, Qatar and Qantas carry none. There is no close-in booking fee and no fee for booking awards by phone."
     },
     "changes": {
      "zh": "獎勵票改票、取消都不收手續費，只要補哩程或稅金的差額。在第一段航班起飛前、而且開票 1 年內取消，哩程會退回，可退的稅金也會退；有夥伴航班的行程，可能要打給訂位中心才能把哩程退回。用過一部分或已過期的獎勵票，哩程不會退回。",
      "en": "Award tickets have no change or cancellation fees; you pay only any difference in miles or taxes. Cancel before your first flight departs and within 1 year of the ticket's issue date, and the miles go back and eligible taxes are refunded; trips with partner flights may need a call to Reservations to reinstate the miles. Partly used or expired awards are not reinstated."
     },
     "tips": [
      {
       "zh": "出發前 7 到 331 天訂位，aa.com 可以保留獎勵票 1 天（部分夥伴比較短），先保住位子再轉點。Citi ThankYou 點數轉 AAdvantage 是 1:1 還是 1:0.7，要看你的 Citi 卡。",
       "en": "When you book 7 to 331 days out, aa.com can hold an award for 1 day (shorter with some partners), so you can hold the seats before moving points. Citi ThankYou points transfer at 1:1 or 1:0.7, depending on your Citi card."
      },
      {
       "zh": "AAdvantage 哩程還不能訂星宇航空，所以西雅圖和台北之間的星宇直飛用不上；可以改看 aa.com 上能訂的其他夥伴，例如國泰航空和日本航空。夥伴獎勵票表把台灣和香港一起放在 Asia Region 2（亞洲第 2 區）。",
       "en": "AAdvantage miles still can't book STARLUX, so its nonstop between Seattle and Taipei is out; look at other partners bookable on aa.com, such as Cathay Pacific and JAL. The partner award chart puts Taiwan in Asia Region 2, together with Hong Kong."
      },
      {
       "zh": "AAdvantage 不能合併哩程，每個帳戶要各訂各的；先把第一筆保留，再訂第二筆，才能確保大家都有位子。",
       "en": "There is no pooling: each AAdvantage account needs its own reservation, so put the first one on hold, then book the second, to keep seats for everyone."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260720072156/https://www.aa.com/i18n/aadvantage-program/answers-support/aadvantage-faq.html",
       "title": "American: AAdvantage FAQ",
       "date": "2026-07-20"
      },
      {
       "url": "https://web.archive.org/web/20260706195313/https://www.aa.com/i18n/aadvantage-program/miles/partners/partner-airlines.jsp",
       "title": "American: partner airlines",
       "date": "2026-07-06"
      },
      {
       "url": "https://web.archive.org/web/20260611133616/https://www.aa.com/i18n/aadvantage-program/use-miles/partner-airline-flights.html",
       "title": "American: partner award chart",
       "date": "2026-06-11"
      },
      {
       "url": "https://www.nerdwallet.com/travel/learn/fuel-surcharge-airlines",
       "title": "NerdWallet: fuel surcharges",
       "date": "2026-09-29"
      },
      {
       "url": "https://awardwallet.com/news/travel-news-roundup-september-26-2026/",
       "title": "AwardWallet: news roundup",
       "date": "2026-09-26"
      },
      {
       "url": "https://www.nerdwallet.com/travel/learn/citi-transfer-partners-guide",
       "title": "NerdWallet: Citi transfer partners",
       "date": "2026-05-08"
      }
     ]
    },
    "azul": {
     "fees": {
      "zh": "稅金用信用卡付，開票前的確認頁面會顯示金額。出發前不到 120 天開票要加收兌換手續費，例如帳戶本人沒有搭乘的國內線 R$69.90；120 天以前開票就不收。",
      "en": "Taxes are paid by credit card and shown on the review screen before the ticket is issued. Awards issued less than 120 days before departure add a redemption fee, for example R$69.90 on a domestic ticket when the account holder is not flying; awards issued 120 or more days ahead have none."
     },
     "changes": {
      "zh": "依巴西規定，出發 7 天以前訂的票，訂後 24 小時內可以免費取消。",
      "en": "Under Brazilian rules, a ticket booked 7 or more days before departure can be cancelled free within 24 hours of booking."
     },
     "tips": [
      {
       "zh": "在 Azul pelo Mundo 上盡量選 award 票價，不要選 public 票價：public 位子比較多，但點數可能高很多。",
       "en": "On Azul pelo Mundo, pick the award fare over the public fare: public fares have more seats but can cost far more points."
      },
      {
       "zh": "Capital One 不能轉 Azul；2021 年的比較也沒看到 Amex、Chase 或 Citi 能轉。",
       "en": "Capital One does not transfer to Azul, and a 2021 comparison showed no route from Amex, Chase or Citi either."
      }
     ],
     "sources": [
      {
       "url": "https://passageirodeprimeira.com/como-emitir-passagem-azul-pelo-mundo/",
       "title": "Passageiro de Primeira: Azul pelo Mundo",
       "date": "2026-07-30"
      },
      {
       "url": "https://passageirodeprimeira.com/como-identificar-tarifa-award-azul-pelo-mundo/",
       "title": "Passageiro de Primeira: award vs public fares"
      },
      {
       "url": "https://pontospravoar.com/azul-fidelidade-reajusta-taxa-para-emissao-de-passagens-com-pontos/",
       "title": "Pontos pra Voar: redemption fee",
       "date": "2026-06-22"
      },
      {
       "url": "https://passageirodeprimeira.com/azul-fidelidade-ajusta-taxa-de-resgate-para-passagens-com-pontos/",
       "title": "Passageiro de Primeira: redemption fee",
       "date": "2026-06-22"
      },
      {
       "url": "https://www.legisweb.com.br/legislacao/?id=333353",
       "title": "ANAC Resolution 400",
       "date": "2016-12-13"
      },
      {
       "url": "https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/",
       "title": "Capital One: transfer partners"
      }
     ]
    },
    "british": {
     "book": {
      "zh": "英國航空和大部分寰宇一家夥伴的獎勵票都能在 ba.com 訂，網站會先列英航航班，再列合作航空；需要訂特定合作航空時，可以打電話請英航協助。愛爾蘭航空的跨大西洋航班，以及混搭兩家以上寰宇一家夥伴的行程，都要打電話訂，從北美打電話訂每人 US$25。合作航空的獎勵票按每段航班的距離計價，所以直飛最省 Avios。",
      "en": "Most BA and oneworld partner awards book on ba.com, which lists BA flights first and then partners; for help with a specific partner, call BA. Aer Lingus transatlantic awards and awards on two or more oneworld partners need a phone call, which costs US$25 per person from North America. Partner awards are priced per flight by distance, so nonstops cost the fewest Avios."
     },
     "fees": {
      "zh": "英航自家長程航班的附加費很高：英航自己寫的是 Club World 商務艙「US$998 加 176,000 Avios 起」。合作航空的附加費看航空公司，美國航空和阿拉斯加航空很低，美國國內線大約 US$5.60。",
      "en": "Awards on BA's own long-haul flights carry high carrier charges: BA advertises Club World business from US$998 plus 176,000 Avios. On partners the charges depend on the airline, and on American and Alaska they are low, about US$5.60 on US domestic flights."
     },
     "changes": {
      "zh": "從北美訂的票，改日期、時間、艙等或取消，每人 US$55（英國 £35，歐盟 €42.50），透過客服中心辦再加 US$25。要退款，最晚要在第一段航班起飛前 24 小時取消。如果當初付的稅費比手續費還低，可以直接放棄稅費、不付手續費，像便宜的美國國內線獎勵票就適合這樣做。",
      "en": "From North America, a date, time or cabin change or a cancellation costs US$55 per person (£35 in the UK, €42.50 in the EU), plus US$25 if done through the service center. To get a refund you must cancel at least 24 hours before the first flight. If the taxes you paid are less than the fee, you can give them up instead of paying it, for example on cheap US domestic awards."
     },
     "tips": [
      {
       "zh": "加入 household account（家庭帳戶）前要想清楚：它能把你和最多 6 個人的 Avios 合併，但加入後只能幫家庭成員和最多 5 位指定親友訂票，名單上的人至少要留 6 個月；不在家庭帳戶裡的會員，則可以幫任何人訂。",
       "en": "Think twice before joining a household account. It pools Avios for you and up to six others, but members can then redeem only for the household and up to 5 nominated family or friends, each kept for at least 6 months; outside a household you can book for anyone."
      },
      {
       "zh": "從西雅圖出發，愛爾蘭航空飛都柏林的獎勵票附加費很低，但 ba.com 訂不到：先在 united.com 找到 Saver 艙位，再打電話給英航訂。",
       "en": "From Seattle, Aer Lingus awards to Dublin carry low surcharges but can't be booked on ba.com: find Saver seats on united.com, then call BA to book."
      }
     ],
     "sources": [
      {
       "url": "https://www.britishairways.com/content/en/us/the-british-airways-club/avios/spending-avios/reward-flights",
       "title": "British Airways: Reward Flights"
      },
      {
       "url": "https://www.britishairways.com/content/en/us/the-british-airways-club/avios/spending-avios/reward-flights/booking-and-service-fees",
       "title": "British Airways: booking and service fees"
      },
      {
       "url": "https://www.britishairways.com/content/en/us/the-british-airways-club/about-the-club/household-accounts",
       "title": "British Airways: household accounts"
      },
      {
       "url": "https://thepointsguy.com/loyalty-programs/ultimate-ba-avios-guide/",
       "title": "The Points Guy: BA Avios guide",
       "date": "2026-08-17"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/how-to-redeem-aer-lingus-avios/",
       "title": "Upgraded Points: Aer Lingus Avios",
       "date": "2026-09-02"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/how-to-redeem-british-airways-avios/",
       "title": "Upgraded Points: redeeming BA Avios",
       "date": "2026-09-02"
      }
     ]
    },
    "connectmiles": {
     "book": {
      "zh": "只能在 copa.com、Copa App 或 ConnectMiles 服務中心兌換；大部分行程可以線上訂，但有些只能透過服務中心訂。聯合航空、土耳其航空、哥倫比亞航空和漢莎航空的獎勵票可以在 ConnectMiles 網站上訂，有些夥伴則要打電話。Star Alliance 夥伴只開 Saver 獎勵票，Standard 獎勵票只有巴拿馬航空和聯合航空的航班才有。",
      "en": "Awards can be redeemed only on copa.com, in the Copa app or through the ConnectMiles Service Center; most book online, but some must go through the Service Center. United, Turkish Airlines, Avianca and Lufthansa awards can be booked on the ConnectMiles site, while some other partners need a call. Star Alliance partners offer Saver awards only; Standard awards exist only on Copa and United flights."
     },
     "fees": {
      "zh": "夥伴航班的獎勵票一般不收燃油附加費，全日空、阿聯酋航空、漢莎航空和瑞士航空都明確列為不收。Base 會員要付 US$30 訂位服務費（Silver 以上免收）；國際線出發前 7 天內才訂，還要付 US$75 晚訂費（Silver 收 US$50，Gold 以上免收）。",
      "en": "Partner awards generally carry no fuel surcharges, and ANA, Emirates, Lufthansa and Swiss are named as surcharge-free. Base members are charged a US$30 booking service fee (free from Silver up) and a US$75 late-booking fee within 7 days of an international departure (US$50 for Silver, free from Gold up)."
     },
     "changes": {
      "zh": "國際線獎勵票，Base 會員在出發前 7 天以上改票收 US$75，7 天內收 US$100，當天改收 US$75；取消並退回哩程，7 天以上收 US$100，7 天內收 US$150。Silver 收得比較少，Gold 以上全免。搭 Star Alliance 夥伴航班的行程，改票要在起飛前至少 24 小時完成；不能改航線、不能改乘客姓名，要退票的話，機票必須完全沒用過，並在開票後一年內申請。",
      "en": "On international awards, Base members pay US$75 to change more than 7 days out, US$100 within 7 days and US$75 on the same day; canceling and redepositing the miles costs US$100, or US$150 within 7 days. Silver pays less and Gold and up pay nothing. Changes on Star Alliance partner flights must be made at least 24 hours before departure, reroutes and name changes are not allowed, and a refund needs an unused ticket and a request within one year of issue."
     },
     "tips": [
      {
       "zh": "Amex、Chase、Citi 和 Capital One 的點數都不能轉進 ConnectMiles，能轉的只有 Marriott Bonvoy（3:1）和 Rove（1:1）。",
       "en": "Amex, Chase, Citi and Capital One points don't transfer to ConnectMiles; the ways in are Marriott Bonvoy at 3:1 and Rove at 1:1."
      },
      {
       "zh": "Copa 網站上的夥伴獎勵票表看起來已經過時，夥伴航班的 Saver 位子很難找，在別家航空網站看到的位子也不一定能用 Copa 訂；轉點之前，先在 ConnectMiles 查好確切航班的價格、確定有位子。",
       "en": "Copa's posted partner award chart looks outdated, partner saver space is hard to find, and space shown on other airlines' sites may not be bookable through Copa, so price and confirm the exact flights in ConnectMiles before moving any points."
      },
      {
       "zh": "只有來回票可以中停（一次）和開口（最多兩個）。要合併哩程只能用 Miles Sharing 帳戶，一個帳戶限一位大人加最多四位小孩。",
       "en": "Only round-trip awards allow a stopover (one) and open jaws (up to two). Pooling is limited to a Miles Sharing account of one adult plus up to four children."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260825121327/https://www.copaair.com/es-gs/connectmiles/millas/reglas-de-boletos-premio/",
       "title": "Copa: award ticket rules",
       "date": "2026-08-25"
      },
      {
       "url": "https://web.archive.org/web/20260810123142/https://www.copaair.com/en-gs/legal/terms-and-conditions/terms-and-conditions-conectmiles/",
       "title": "Copa: ConnectMiles terms",
       "date": "2026-08-10"
      },
      {
       "url": "https://web.archive.org/web/20260825121325/https://www.copaair.com/es-gs/connectmiles/millas/viajando-en-star-alliance/",
       "title": "Copa: Star Alliance awards",
       "date": "2026-08-25"
      },
      {
       "url": "https://thepointsguy.com/news/rove-copa-connectmiles-transfer-partner/",
       "title": "The Points Guy",
       "date": "2026-09-01"
      },
      {
       "url": "https://frequentmiler.com/rove-copa-airlines-transfer-partner-bonus/",
       "title": "Frequent Miler",
       "date": "2026-10-01"
      },
      {
       "url": "https://awardwallet.com/news/rove-miles/copa-transfer-partner/",
       "title": "AwardWallet",
       "date": "2026-10-01"
      }
     ]
    },
    "delta": {
     "book": {
      "zh": "達美航空自家航班，以及中華航空、大韓航空、法國航空、荷蘭皇家航空、維珍航空、越南航空和廈門航空的獎勵票，都能在 delta.com 訂。Air Europa、大溪地航空和肯亞航空要打電話給達美訂位，天馬航空（Skymark）要填線上申請表。達美不能先保留獎勵機位。",
      "en": "Delta flights and partner awards on China Airlines, Korean Air, Air France, KLM, Virgin Atlantic, Vietnam Airlines and Xiamen Air book on delta.com. Air Europa, Air Tahiti Nui and Kenya Airways need a call to Delta Reservations, and Skymark uses an online request form. Delta won't hold award seats."
     },
     "fees": {
      "zh": "達美自家航班頂多只有從歐洲出發的行程會加收附加費，大韓航空、越南航空和印尼航空（Garuda）的獎勵票則沒有。部分合作航空的附加費會轉嫁給你，在訂位時一起收，例如中國東方航空、Air Europa、墨西哥國際航空，以及維珍航空從倫敦希斯洛出發的航班。唯一的訂位手續費，是在部分歐洲國家開票時收的 US$25 到 US$35 直接開票費，提出要求就能免收。",
      "en": "Delta's own flights add surcharges at most on trips that start in Europe, and Korean Air, Vietnam Airlines and Garuda awards have none. Some partners' surcharges are passed on and collected at booking, for example on China Eastern, Air Europa, Aeromexico, and Virgin Atlantic flights from London Heathrow. The only booking fee is a US$25 to US$35 direct ticketing charge on tickets issued in some European countries, waived on request."
     },
     "changes": {
      "zh": "從美國或加拿大出發的 Classic 獎勵票，起飛前隨時可以免費改票或取消，哩程退回帳戶；Basic 獎勵票要付哩程當手續費。從其他地方出發（例如台北）的獎勵票，退回哩程要付 US$150，不過不一定每次都收。一旦開始旅程，沒搭的部分不退。",
      "en": "Classic awards that start in the US or Canada can be changed or canceled free any time before departure, with the miles returned; Basic awards pay a fee in miles. Awards that start anywhere else, such as Taipei, pay a US$150 redeposit fee, though it is not always enforced. Once travel starts, the unused part is not refunded."
     },
     "tips": [
      {
       "zh": "信用卡點數裡只有 Amex Membership Rewards 能轉 SkyMiles（1:1），而且 Amex 會另收每點 US$0.0006 的消費稅補償費，上限 US$99。",
       "en": "Among credit card points, only Amex Membership Rewards transfers to SkyMiles (1:1), and Amex adds an excise-tax offset fee of US$0.0006 per point, capped at US$99."
      },
      {
       "zh": "來回票從西雅圖出發，不要從台北出發：美國和加拿大以外出發的獎勵票，退回哩程要付 US$150，從美國出發的 Classic 獎勵票則可以免費取消。",
       "en": "Start round trips in Seattle, not Taipei: awards that start outside the US and Canada pay US$150 to redeposit, while US-origin Classic awards cancel free."
      }
     ],
     "sources": [
      {
       "url": "https://www.delta.com/us/en/skymiles/how-to-use-miles/travel-with-miles",
       "title": "Delta: Travel with Miles"
      },
      {
       "url": "https://www.delta.com/us/en/baggage/overview",
       "title": "Delta: baggage and travel fees"
      },
      {
       "url": "https://www.delta.com/us/en/skymiles/program-resources/program-rules",
       "title": "Delta: SkyMiles program rules",
       "date": "2026-01-01"
      },
      {
       "url": "https://onemileatatime.com/guides/airline-award-ticket-fees/",
       "title": "One Mile at a Time: award ticket fees",
       "date": "2026-09-10"
      },
      {
       "url": "https://awardwallet.com/airlines/avoid-surcharges-award-flights/",
       "title": "AwardWallet: avoiding surcharges",
       "date": "2026-07-18"
      },
      {
       "url": "https://thriftytraveler.com/news/points/amex-points-transfer-fees/",
       "title": "Thrifty Traveler: Amex transfer fees",
       "date": "2025-08-15"
      }
     ]
    },
    "emirates": {
     "book": {
      "zh": "阿聯酋航空的 Classic Rewards 可以在 emirates.com、app 或客服中心訂，訂好後也能在「Manage your booking」線上改。部分夥伴（包括日本航空和 United）可以線上訂，在航空公司選單選「Partner」，不過日本航空常常訂不成功。其他夥伴的訂位，以及所有夥伴獎勵票的更改，都要透過 Live Chat。",
      "en": "Emirates Classic Rewards book on emirates.com, in the app or through the call center, and can be changed online in Manage your booking. Some partners, including Japan Airlines and United, book online by choosing \"Partner\" in the airline dropdown, though JAL bookings often fail there. Other partners, and any change to a partner reward, go through Live Chat."
     },
     "fees": {
      "zh": "阿聯酋航空自家航班的附加費很高，要自己付，不過可以用 Skywards 哩程付。日本航空和 United 的夥伴獎勵票，哩程數同樣不含稅金、燃油附加費和其他費用，要另外付。",
      "en": "Emirates-operated flights carry high carrier-imposed surcharges; they are your cost, but you can pay them with Skywards Miles. JAL and United partner rewards are also priced without taxes, fuel surcharges and other charges, which are added on top."
     },
     "changes": {
      "zh": "Saver 獎勵票第一次改日期免費，之後每次 US$25；其他更改 US$25，出發前退票 US$75。Flex Plus 出發前改票、退票都免費，任何獎勵票飛了之後都不能退。夥伴獎勵票改票規則一樣，但只有完全沒用過的票才能退（US$75），已過期的哩程不會退回。",
      "en": "Saver awards get one free date change, then US$25 per change; other changes cost US$25 and a refund before travel costs US$75. Flex Plus changes and refunds before travel are free, and no award can be refunded after travel. Partner rewards follow the same change fees, but only fully unused tickets can be refunded (US$75), and expired miles are not put back."
     },
     "tips": [
      {
       "zh": "從 2026 年 5 月下旬起，商務艙 Saver 獎勵票可以訂單程；官網有些說明還寫著單程商務艙只有 Flex Plus，所以付 Flex Plus 之前先搜單程 Saver。",
       "en": "Since late May 2026 business Saver awards can be booked one way, even though some Emirates help pages still say one-way business is Flex Plus only, so search one-way Saver before paying for Flex Plus."
      },
      {
       "zh": "日本航空和 United 的夥伴獎勵票按直飛航段計價，轉一次機可能要付兩張獎勵票的哩程。",
       "en": "JAL and United partner rewards are priced per nonstop flight, so a trip with a connection may need two rewards."
      },
      {
       "zh": "My Family 讓一位家長最多合併 7 位家人的 Skywards 哩程，每位家人只能選全部提供（100%）或不提供（0%）。",
       "en": "My Family lets a family head pool Skywards Miles from up to seven family members, each giving either 0% or 100% of their miles."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260716052623/https://www.emirates.com/us/english/help/faq-topics/emirates-skywards/",
       "title": "Emirates: Skywards FAQ (archived)",
       "date": "2026-07-16"
      },
      {
       "url": "https://web.archive.org/web/20260831140715/https://www.emirates.com/us/english/skywards/emirates-skywards-programme-rules/",
       "title": "Emirates: Skywards rules (archived)",
       "date": "2026-08-31"
      },
      {
       "url": "https://web.archive.org/web/20260115050523/https://www.emirates.com/us/english/skywards/partners/japan-airlines/",
       "title": "Emirates: JAL partner page (archived)",
       "date": "2026-01-15"
      },
      {
       "url": "https://web.archive.org/web/20260412200023/https://www.emirates.com/us/english/skywards/partners/united/",
       "title": "Emirates: United partner page (archived)",
       "date": "2026-04-12"
      },
      {
       "url": "https://onemileatatime.com/news/emirates-skywards-devalues-miles/",
       "title": "One Mile at a Time",
       "date": "2026-05-20"
      },
      {
       "url": "https://awardwallet.com/airlines/award-ticket-change-and-cancellation-policies/",
       "title": "AwardWallet: change and cancel fees",
       "date": "2026-10-04"
      }
     ]
    },
    "ethiopian": {
     "book": {
      "zh": "獎勵票可以開給自己或你指定的受益人，Star Alliance 夥伴的獎勵票可以直接在衣索比亞航空官網或 App 上訂。條款也允許到衣索比亞航空售票處辦理：本人親自去、請法定代理人去，或從線上帳戶送出電子授權書；沒有列出電話訂位管道。夥伴航班的位子常常不好找，國際線夥伴航班可能需要客服人員手動協助。",
      "en": "You can book awards for yourself or for beneficiaries you nominate, and Star Alliance partner awards can be booked directly on Ethiopian's website or app. The terms also allow booking at Ethiopian ticket offices: in person, through a legal delegate, or with an electronic authorization form sent from your online account; no phone booking channel is listed. Partner space is often hard to find, and international partner flights may need an agent's help."
     },
     "fees": {
      "zh": "衣索比亞航空只說稅金、手續費和「carrier charges」（航空公司附加費）會在訂位時報價、開票時付清，沒說哪些航空公司的燃油附加費會轉嫁；到 2026 年 8 月底，衣索比亞航空開的獎勵票稅費多少仍不清楚。官方沒有公布獎勵票的訂位費或電話訂位費。",
      "en": "Ethiopian says only that taxes, fees and carrier charges are quoted when you book and paid at ticketing; it does not say which carriers' surcharges are passed on, and as of late August 2026 the taxes and fees on Ethiopian-issued awards were still unclear. No award booking or phone fee is published."
     },
     "changes": {
      "zh": "在獎勵票一年效期內改日期或航班，國際線收 US$50（衣索比亞國內線 US$20）；Silver 有一次免費改票，Gold 兩次，Platinum 不限次數。開票後不能改名字，也不能改航線：要改航線，得付手續費把哩程退回帳戶，再重新開票。完全沒用過的獎勵票可以在到期前退，國際線收 US$100（Platinum 免收）；一旦開始搭乘，就什麼都不退。",
      "en": "Date or flight changes within the award's one-year validity cost US$50 on international flights (US$20 on Ethiopian domestic flights); Silver gets one free rebooking, Gold two and Platinum unlimited. Issued awards can't be renamed or rerouted: to reroute, the miles are re-credited for a fee and a new award is issued. A fully unused award can be refunded before it expires for US$100 on international flights (free for Platinum), and nothing is refunded once travel has started."
     },
     "tips": [
      {
       "zh": "Amex、Chase、Citi 和 Capital One 的點數都轉不進 ShebaMiles：銀行點數只有 US Bank（Altitude Reserve 卡，1:1）能轉，Marriott Bonvoy 則是 3:1，每轉 60,000 點加送 5,000 哩。哩程也可以轉給其他會員，以 1,000 哩為單位，每 1,000 哩 US$18。",
       "en": "Amex, Chase, Citi and Capital One points can't reach ShebaMiles: US Bank (Altitude Reserve cards, 1:1) is the only bank program that transfers in, and Marriott Bonvoy converts at 3:1 with 5,000 bonus miles per 60,000 points. Miles can also be moved to another member for US$18 per 1,000, in blocks of 1,000."
      },
      {
       "zh": "Star Alliance 獎勵票的單程要花來回的 75% 哩程，所以訂來回比較省。官方試算工具顯示遠東區（包含台灣）到北美的商務艙是 180,000 哩，但沒寫是單程還是來回。",
       "en": "On Star Alliance awards a one-way costs 75% of the round-trip miles, so round trips are the better deal. The award calculator shows 180,000 miles in business between the Far East (which includes Taiwan) and North America, without saying whether that is one-way or round trip."
      },
      {
       "zh": "韓亞航空即將退出 Star Alliance，用 ShebaMiles 訂韓亞航空執飛的航班，只限 2026 年 12 月 16 日（含）以前出發。",
       "en": "Asiana is leaving Star Alliance, so ShebaMiles awards on Asiana-operated flights are valid only for departures on or before December 16, 2026."
      }
     ],
     "sources": [
      {
       "url": "https://shebamiles.ethiopianairlines.com/miles/spend-miles/star-alliance-flight-award",
       "title": "ShebaMiles: Star Alliance awards"
      },
      {
       "url": "https://shebamiles.ethiopianairlines.com/miles/spend-miles",
       "title": "ShebaMiles: spend miles"
      },
      {
       "url": "https://shebamiles.ethiopianairlines.com/support/terms-and-conditions",
       "title": "ShebaMiles: terms and conditions"
      },
      {
       "url": "https://shebamiles.ethiopianairlines.com/support/program-updates",
       "title": "ShebaMiles: program updates",
       "date": "2026-09-17"
      },
      {
       "url": "https://frequentmiler.com/wow-us-bank-launches-transfer-partners-accor-flying-blue-qanas-and-ethiopian-partner-for-now/",
       "title": "Frequent Miler",
       "date": "2026-08-29"
      },
      {
       "url": "https://www.marriott.com/loyalty/redeem/travel/points-to-miles.mi",
       "title": "Marriott: points to miles"
      }
     ]
    },
    "etihad": {
     "book": {
      "zh": "在 etihad.com 或 app 選「pay with miles」就能訂阿提哈德航空的航班：可以訂固定價格的 Promo 座位，也可以用哩程加信用卡或簽帳卡買任何座位。夥伴獎勵票可以線上或打電話訂，夥伴航班一樣可以用哩程加卡付。美國航空的轉機行程按全程總飛行距離計價，不是每段分開算。",
      "en": "On etihad.com or the app, \"pay with miles\" books Etihad flights either as fixed-price Promo seats or as any seat paid with miles plus a debit or credit card. Partner awards book online or by phone, and partner flights can also be paid with miles plus a card. On American Airlines, connecting awards are priced on the total distance flown, not per segment."
     },
     "changes": {
      "zh": "2025 年 11 月 13 日起開票或重開的票，出發前 72 小時內一律不能改、不能退。72 小時以前：Value 改票 AED 600、不能退；Comfort 改票 AED 200、退票扣 25%；Deluxe 改退都免費。",
      "en": "For tickets issued or reissued from November 13, 2025, nothing can be changed or cancelled within 72 hours of departure. Before that, Value awards cost AED 600 to change and can't be cancelled, Comfort awards cost AED 200 to change or 25% to cancel, and Deluxe awards are free to change or cancel."
     },
     "tips": [
      {
       "zh": "Amex 從 2026 年 6 月 30 日起不能再轉 Etihad Guest；Citi、Capital One 和 Bilt 還可以轉。",
       "en": "Amex stopped transferring to Etihad Guest on June 30, 2026; Citi, Capital One and Bilt still transfer."
      },
      {
       "zh": "Family Membership 可以讓家長把全家人的哩程合起來訂同一趟行程。",
       "en": "Family Membership lets the head of the family pool all members' miles for one trip."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260914020917/https://www.etihad.com/en/etihadguest/spend-miles/fly-with-miles",
       "title": "Etihad: fly with miles (archived)",
       "date": "2026-09-14"
      },
      {
       "url": "https://web.archive.org/web/20260831140721/https://www.etihad.com/en/help/faq/fares",
       "title": "Etihad: fares FAQ (archived)",
       "date": "2026-08-31"
      },
      {
       "url": "https://web.archive.org/web/20260919042920/https://www.etihad.com/en/etihadguest/family-membership",
       "title": "Etihad: Family Membership (archived)",
       "date": "2026-09-19"
      },
      {
       "url": "https://awardwallet.com/airlines/book-american-flights-etihad-miles/",
       "title": "AwardWallet: American via Etihad",
       "date": "2026-08-09"
      },
      {
       "url": "https://onemileatatime.com/guides/airline-award-ticket-fees/",
       "title": "One Mile at a Time: award fees",
       "date": "2026-09-10"
      },
      {
       "url": "https://frequentmiler.com/etihad-guest-to-be-dropped-from-american-express-membership-rewards-transfer-partners-on-6-30-26/",
       "title": "Frequent Miler: Amex drops Etihad",
       "date": "2026-06-23"
      }
     ]
    },
    "eurobonus": {
     "book": {
      "zh": "SAS 和 Widerøe 的獎勵票在官網選「Pay with points」就能訂，SkyTeam 夥伴的獎勵票也能線上訂，而且 SAS 和夥伴航班可以放在同一筆訂位。打電話訂要另收服務費（除非那趟行程網站訂不了）。回程想從另一個機場出發，要打給客服訂。",
      "en": "SAS and Widerøe awards book online with \"Pay with points\", and SkyTeam partner awards book online too, with SAS and partner flights mixable in one booking. Booking by phone adds a service fee unless the trip can't be booked online. A return from a different airport needs a call to Customer Service."
     },
     "fees": {
      "zh": "從美國出發的 SAS 航班附加費很低：紐華克飛哥本哈根的商務艙獎勵票每人約 US$25。夥伴獎勵票的點數不含稅金和航空公司附加費，另外每位旅客還要付 €25 到 €95 的訂位手續費。",
      "en": "Surcharges are low on SAS flights from the US: about US$25 per person on a Newark to Copenhagen business award. Partner award prices exclude taxes and carrier-imposed fees, and partner bookings add a booking fee of €25 to €95 per traveler."
     },
     "changes": {
      "zh": "SAS 自營航班的獎勵票在出發前 1 小時以前都能取消或改訂，國內和歐洲線 €25，往返亞洲和北美 €75。夥伴獎勵票訂後 24 小時內免費取消，之後到出發前 24 小時都能取消或改訂，每位旅客歐洲內 €25、國際線 €75。夥伴票取消時訂位手續費會退，但已過期的點數不退。",
      "en": "SAS-operated awards can be cancelled or rebooked up to 1 hour before departure for €25 (domestic and Europe) or €75 (to or from Asia and North America). Partner awards cancel free within 24 hours of booking, then can be cancelled or rebooked up to 24 hours before departure for €25 within Europe or €75 internationally per traveler. On partner awards the booking fee is refunded, but points that have expired are not."
     },
     "tips": [
      {
       "zh": "夥伴獎勵票單程是來回價的 60%；行程只要有中華航空、Air Europa 或越南航空的航班，點數就要加倍。",
       "en": "On partner awards a one-way costs 60% of the round-trip price, and any itinerary with a China Airlines, Air Europa or Vietnam Airlines flight costs double points."
      },
      {
       "zh": "可以轉進 EuroBonus 的點數有 Rove、Revolut RevPoints 和 Klarna（美國）。",
       "en": "Points transfer in from Rove, Revolut RevPoints and Klarna (US)."
      },
      {
       "zh": "2 到 11 歲的小孩搭 SAS 自營航班，點數只要一半。",
       "en": "Children aged 2 to 11 pay half the points on SAS-operated flights."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260527154256/https://www.flysas.com/pl-en/eurobonus/points/use/partner-award-flights/",
       "title": "SAS: partner awards (archived)",
       "date": "2026-05-27"
      },
      {
       "url": "https://web.archive.org/web/20260329083806/https://www.flysas.com/us-en/eurobonus/points/use/partner-award-flights/",
       "title": "SAS: partner awards, US page (archived)",
       "date": "2026-03-29"
      },
      {
       "url": "https://frequentmiler.com/sas-business-class-a330-from-newark-ewr-to-copenhagen-cph-bottom-line-review/",
       "title": "Frequent Miler: SAS business review",
       "date": "2025-12-11"
      },
      {
       "url": "https://awardwallet.com/airlines/award-ticket-change-and-cancellation-policies/",
       "title": "AwardWallet: change and cancel fees",
       "date": "2026-10-04"
      },
      {
       "url": "https://frequentmiler.com/rove-adds-sas-as-new-transfer-partner-with-20-transfer-bonus/",
       "title": "Frequent Miler: Rove adds SAS",
       "date": "2026-03-09"
      },
      {
       "url": "https://awardwallet.com/news/airlines/sas-eurobonus-award-sale/",
       "title": "AwardWallet: SAS award sale",
       "date": "2026-05-13"
      }
     ]
    },
    "finnair": {
     "book": {
      "zh": "芬蘭航空自家航班，以及英國航空、國泰航空、伊比利亞航空、日本航空、澳洲航空、卡達航空的獎勵票，可以在 finnair.com 線上訂；美國航空、阿拉斯加航空和夏威夷航空、斐濟航空、LATAM、馬來西亞航空、阿曼航空、摩洛哥皇家航空、約旦皇家航空和斯里蘭卡航空，要用線上客服或打電話。一張獎勵票只能用一家合作航空（可以再加芬蘭航空的航班），合作航空的票會在一天內開出。幫任何人訂都可以，訂位時給名字就好。",
      "en": "Awards on Finnair and on British Airways, Cathay Pacific, Iberia, Japan Airlines, Qantas and Qatar Airways book online at finnair.com; American, Alaska and Hawaiian, Fiji, LATAM, Malaysia, Oman Air, Royal Air Maroc, Royal Jordanian and SriLankan need chat or a phone call. Each award can use only one partner airline (Finnair flights can be added), and partner awards are ticketed within a day. You can book awards for anyone by giving their name."
     },
     "fees": {
      "zh": "芬蘭航空自家航班的獎勵票，每個方向加收固定附加費，而且不能用 Avios 付：商務艙飛亞洲和北美大部分城市是 €100，飛日本、新加坡和洛杉磯是 €120。合作航空的獎勵票要付該航空公司的稅金和附加費。透過客服訂芬蘭航空的獎勵票，單程多扣 500 Avios（來回 1,000 Avios）。",
      "en": "Awards on Finnair's own flights add a fixed surcharge per direction that can't be paid with Avios: in business it is €100 to most of Asia and North America and €120 to Japan, Singapore and Los Angeles. Partner awards pass on the operating airline's taxes and surcharges. Booking a Finnair award through customer service costs an extra 500 Avios one-way (1,000 round trip)."
     },
     "changes": {
      "zh": "開票後改票或退票每張 €50，期限是起飛前 3 小時，但也可能要在 24 小時前，最好早點辦。沒搭又沒取消（no-show），Avios 不退。合作航空的獎勵票在出發前可以付費更改，一旦開始旅程就不能改，取消也要收費。",
      "en": "After ticketing, a change or cancellation costs €50 per ticket; the cutoff is 3 hours before departure, but it may be 24 hours, so do it early. A no-show loses the Avios. Partner awards can be changed for a fee before departure but not once travel has started, and cancelling them also costs a fee."
     },
     "tips": [
      {
       "zh": "從台灣出發，用 Finnair Plus 訂國泰航空是按區域計價：亞洲到北美商務艙單程 85,000 Avios，出發地和目的地區域內的轉機都包含在內。芬蘭航空也曾查到 AAdvantage 和阿拉斯加航空查不到的國泰商務艙位。",
       "en": "From Taiwan, Cathay Pacific through Finnair is priced by zone: Asia to North America is 85,000 Avios one-way in business, and connections inside the origin and destination zones are included. Finnair has also shown Cathay business seats that AAdvantage and Alaska did not."
      },
      {
       "zh": "西雅圖在芬蘭航空的第 6 區，西雅圖飛赫爾辛基的芬蘭航空商務艙單程是 62,500 Avios 加 €100。網站的國家要選「Finland」，才看得到所有保證釋出的獎勵艙位。",
       "en": "Seattle is in Finnair's zone 6, so a Finnair business award from Seattle to Helsinki costs 62,500 Avios plus €100 one-way. Set the site's country to Finland to see all guaranteed award seats."
      },
      {
       "zh": "Finnair Plus 的 Avios 只要 18 個月沒有累積或使用就會過期，在不同計畫之間轉 Avios 不算活動，所以要訂之前再轉進來。",
       "en": "Finnair Plus Avios expire after 18 months with no earning or spending, and moving Avios between programs doesn't count as activity, so transfer them in only when you are ready to book."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260831140751/https://www.finnair.com/en/finnair-plus/collect-and-use-avios/use-avios-on-finnair-award-flights",
       "title": "Finnair: award flights on Finnair",
       "date": "2026-08-31"
      },
      {
       "url": "https://web.archive.org/web/20260831140752/https://www.finnair.com/en/finnair-plus/collect-and-use-avios/use-avios-on-award-flights-with-partners",
       "title": "Finnair: partner award flights",
       "date": "2026-08-31"
      },
      {
       "url": "https://web.archive.org/web/20260819184850/https://www.finnair.com/us-en/finnair-plus/finnair-plus-rules",
       "title": "Finnair Plus rules",
       "date": "2026-08-19"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/best-ways-to-redeem-finnair-plus-avios/",
       "title": "Upgraded Points: Finnair Plus Avios",
       "date": "2026-06-12"
      },
      {
       "url": "https://onemileatatime.com/guides/airline-award-seat-guarantee/",
       "title": "One Mile at a Time: award seat guarantees",
       "date": "2026-03-04"
      },
      {
       "url": "https://frequentmiler.com/finnair-18-month-expiry-moving-points/",
       "title": "Frequent Miler: Finnair Avios expiry",
       "date": "2026-04-28"
      }
     ]
    },
    "flyingblue": {
     "book": {
      "zh": "Flying Blue 會把你轉到 airfrance.com 或 klm.com 訂位，可以訂法國航空、荷蘭皇家航空、天合聯盟夥伴，以及 Aircalin、GOL、日本航空和 TAROM。帶嬰兒、無人陪伴兒童或要中停的訂位，要打電話給客服。2026 年 9 月 8 日起，法航和荷航的獎勵票分成 Light、Standard、Flex 三種，和合作航空混搭的行程只能選 Standard。",
      "en": "Flying Blue sends you to airfrance.com or klm.com to book Air France, KLM and SkyTeam partners, plus Aircalin, GOL, Japan Airlines and TAROM. Bookings with infants, unaccompanied minors or stopovers need a call to customer service. Since 8 Sep 2026, Air France and KLM flights come in Light, Standard or Flex fares, and trips that mix them with a partner offer Standard only."
     },
     "fees": {
      "zh": "法航和荷航的航班有附加費，2026 年 3 月又漲了：經濟艙來回約多 US$60，商務艙約多 US$100，美國飛歐洲商務艙單程的稅費從約 US$250 漲到約 US$350；Flex 票價的附加費比較低。大部分合作航空也有附加費，包括維珍航空，但達美航空和墨西哥國際航空的航班沒有。",
      "en": "Air France and KLM flights carry surcharges, and in March 2026 they rose by about US$60 on an economy round trip and US$100 in business, taking a US to Europe business one-way from about US$250 to about US$350 in taxes and fees; Flex fares come with lower surcharges. Most partners also carry surcharges, Virgin Atlantic included, but Delta and Aeromexico flights do not."
     },
     "changes": {
      "zh": "2026 年 9 月 8 日起，法航和荷航的 Light 獎勵票不能改也不能退（Platinum 和 Ultimate 會員免費），Standard 每次改票或退票 €70，Flex 免費。只搭合作航空的獎勵票，改票或退回哩程照舊收 €70。最晚要在報到截止前提出，起飛後就不能改或取消。",
      "en": "From 8 Sep 2026, Air France and KLM Light rewards can't be changed or refunded (free for Platinum and Ultimate members), Standard costs €70 per change or refund, and Flex is free. Awards on partners alone keep the €70 fee to change or redeposit. Requests are accepted until the latest check-in time and never after departure."
     },
     "tips": [
      {
       "zh": "Promo Rewards 現在是用 Light 票價計算，除非你是 Platinum 或 Ultimate，否則不能改也不能退；行程可能會變的話，選 Standard 或 Flex。",
       "en": "Promo Rewards are now priced at the Light fare, which can't be changed or refunded unless you are Platinum or Ultimate, so pick Standard or Flex if your plans might change."
      },
      {
       "zh": "單程獎勵票可以免費中停，搭合作航空也行，但只能打電話訂；客服也可以幫你把獎勵票保留最多 72 小時。",
       "en": "A one-way award can include a free stopover, partner flights included, but only by phone; the call center can also hold an award for up to 72 hours."
      },
      {
       "zh": "免費的 Flying Blue Family 最多可讓 8 位成員（最多 2 位大人）合併哩程，2 到 11 歲的兒童在法航或荷航網站訂獎勵票打 75 折。",
       "en": "A free Flying Blue Family pools Miles for up to eight members (at most two adults), and children aged 2 to 11 get 25% off rewards booked on the Air France or KLM site."
      }
     ],
     "sources": [
      {
       "url": "https://www.flyingblue.com/en/news/light-standard-flex-reward-tickets-september-2026",
       "title": "Flying Blue: Light, Standard and Flex"
      },
      {
       "url": "https://www.flyingblue.com/en/spend/flights/rewards",
       "title": "Flying Blue: reward tickets"
      },
      {
       "url": "https://princeoftravel.com/points-programs/air-france-klm-flying-blue/",
       "title": "Prince of Travel: Flying Blue",
       "date": "2026-10-14"
      },
      {
       "url": "https://onemileatatime.com/news/flying-blue-award-pricing-changes-tiered-fares-devaluation/",
       "title": "One Mile at a Time: Flying Blue fare tiers",
       "date": "2026-08-19"
      },
      {
       "url": "https://frequentmiler.com/air-france-klm-flying-blue-increases-award-surcharges-by-100-in-business-class/",
       "title": "Frequent Miler: Flying Blue surcharge increase",
       "date": "2026-03-27"
      },
      {
       "url": "https://frequentmiler.com/award-ticket-change-and-cancellation-fees-by-transfer-partner/",
       "title": "Frequent Miler: award change fees",
       "date": "2026-07-24"
      }
     ]
    },
    "frontier": {
     "book": {
      "zh": "Frontier Miles 只能用在邊疆航空自己營運和銷售的航班，沒有合作航空公司，夥伴或旅行社也不能開獎勵票。在 FlyFrontier.com 或 app 訂不收手續費，透過訂位中心（Reservations Center）訂每人加收 US$35。獎勵票大約 8 個月前開放，不能中途停留。",
      "en": "Frontier Miles can only be used on flights Frontier operates and markets: there are no partner airlines, and partners or travel agents can't issue awards. Booking on FlyFrontier.com or the app has no booking charge, while the Reservations Center adds US$35 per passenger. Awards open about 8 months ahead, and stopovers are not allowed."
     },
     "fees": {
      "zh": "稅金和航空公司附加費都要自己付：美國國內單程稅金從 US$5.60 起，國外更高，例如飛墨西哥 US$40.71。邊疆航空說可能另收兌換手續費，但沒公布金額，而且這筆費用不退。",
      "en": "Taxes and any airline surcharges are yours to pay: taxes start at US$5.60 one-way in the US and are higher abroad, for example US$40.71 to Mexico. Frontier says a redemption fee may apply but publishes no amount, and redemption fees are non-refundable."
     },
     "changes": {
      "zh": "2026 年 9 月 25 日起訂的 Basic 或 Standard 獎勵票，出發 60 天以前改票免費，之後每人每個方向 US$149，取消也是每人每個方向 US$149。Economy、Premium 和 Business 套票改退都不收費。沒在出發前取消，哩程就沒了；菁英會員目前在出發 7 天以前改票免費，但 2027 年 1 月 1 日生效的會員福利清單裡沒有這一項。",
      "en": "For Basic or Standard awards booked on or after September 25, 2026, changes are free 60 or more days before departure and cost US$149 per passenger per direction after that, and cancelling costs US$149 per passenger per direction. Economy, Premium and Business bundles have no change or cancel fees. If you don't cancel before departure the miles are lost; elite members change free 7 or more days out, but that benefit is not on the elite list that takes effect January 1, 2027."
     },
     "tips": [
      {
       "zh": "邊疆航空的獎勵票只到美國、墨西哥、加勒比海和中美洲，沒有亞洲，只適合用來接駁。",
       "en": "Frontier awards cover only the US, Mexico, the Caribbean and Central America, not Asia, so it is only useful for positioning flights."
      },
      {
       "zh": "用哩程加購套票（Economy 套票 2,000 哩起），就不用付改票和取消費。",
       "en": "Adding a bundle paid with miles (Economy from 2,000 miles) removes change and cancel fees."
      },
      {
       "zh": "Family Pooling 可以由一位主帳戶加最多 8 位成員共用哩程，但主帳戶必須持有 Frontier Airlines World Mastercard 或有菁英會籍。",
       "en": "Family Pooling allows a primary holder plus up to 8 contributors, but the primary must hold the Frontier Airlines World Mastercard or elite status."
      }
     ],
     "sources": [
      {
       "url": "https://www.flyfrontier.com/frontiermiles/terms-and-conditions/",
       "title": "Frontier Miles: terms"
      },
      {
       "url": "https://www.flyfrontier.com/optional-services/",
       "title": "Frontier: optional services"
      },
      {
       "url": "https://www.flyfrontier.com/frontiermiles/how-to-use-miles/",
       "title": "Frontier: how to use miles"
      },
      {
       "url": "https://faq.flyfrontier.com/help/how-do-i-use-my-miles",
       "title": "Frontier FAQ: using miles",
       "date": "2026-09-11"
      },
      {
       "url": "https://faq.flyfrontier.com/help/will-i-be-charged-a-fee-to-change-my-reservation",
       "title": "Frontier FAQ: change fees"
      },
      {
       "url": "https://news.flyfrontier.com/frontier-miles-members-can-now-redeem-miles-for-bags-seats-priority-boarding-and-more/",
       "title": "Frontier news: bundles with miles",
       "date": "2025-10-28"
      }
     ]
    },
    "iberia": {
     "book": {
      "zh": "伊比利亞航空自家航班和部分合作航空（例如美國航空、英國航空）可以在 iberia.com 訂；網站上查不到的合作航空，例如摩洛哥皇家航空，要打電話（美國：800-772-4642），在美國開的電話票每張 US$24，Platino 以上等級免收。Avios 機票只能開給你自己、事先指定的受益人或同行旅伴，但用 Family Account 裡的 Avios 就能幫任何人開票。",
      "en": "Awards on Iberia's own flights and some partners, such as American and BA, book on iberia.com; partners the site doesn't show, such as Royal Air Maroc, need a call (US: 800-772-4642), and phone tickets issued in the US cost US$24 each, waived for Platino and higher tiers. Avios tickets can go only to you, your saved beneficiaries or a companion on the same trip, but Avios from a Family Account can ticket anyone."
     },
     "fees": {
      "zh": "伊比利亞航空自家航班的附加費低：離峰時段紐約（JFK）飛馬德里商務艙單程，曾經是 40,500 Avios 加 US$83.75；不過條款仍保留加收營運商費用的權利。在 iberia.com 訂英航航班，一樣要付英航的高額附加費；附加費最高的合作航空通常是英國航空、馬來西亞航空和卡達航空。",
      "en": "Charges on Iberia's own flights are low: an off-peak New York (JFK) to Madrid business one-way has priced at 40,500 Avios plus US$83.75, though Iberia's terms still allow it to add an operator fee. BA flights booked on iberia.com keep BA's high surcharges, and BA, Malaysia and Qatar are typically the partners with the highest surcharges."
     },
     "changes": {
      "zh": "只要獎勵票裡有一段是寰宇一家或其他合作航空的航班，就不能改也不能退。",
      "en": "Any award ticket that includes a flight on a oneworld or other partner airline can't be changed or refunded."
     },
     "tips": [
      {
       "zh": "伊比利亞航空的 Family Account 最多可以讓 7 位 Iberia Club 會員合併 Avios，不需要有親屬關係；每位成員加入後至少要留 12 個月，合併的 Avios 可以幫任何人開票。",
       "en": "Iberia's Family Account pools Avios for up to 7 Iberia Club members with no family-relationship requirement; each member must stay at least 12 months, and the pooled Avios can ticket anyone."
      },
      {
       "zh": "要訂合作航空，改用 British Airways Club、Privilege Club 或 Finnair Plus：伊比利亞航空的合作航空獎勵票一開票就不能改也不能退，而 Avios 在這些計畫之間可以免費互轉。",
       "en": "Book partner flights through BA, Qatar or Finnair instead: Iberia partner awards can't be changed or refunded once issued, and Avios move between these programs for free."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260414205714/https://www.iberia.com/gb/iberiaplus/conditions/",
       "title": "Iberia: Iberia Club terms",
       "date": "2026-04-14"
      },
      {
       "url": "https://web.archive.org/web/20251014105424/https://www.iberia.com/us/service-fees/",
       "title": "Iberia: service fees",
       "date": "2025-10-14"
      },
      {
       "url": "https://frequentmiler.com/avios-complete-guide-british-airways-qatar-iberia-aer-lingus-finnair/",
       "title": "Frequent Miler: Avios guide",
       "date": "2025-05-25"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/using-british-airways-avios-without-huge-fuel-surcharges/",
       "title": "Upgraded Points: Avios without big surcharges",
       "date": "2026-02-08"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/best-ways-to-redeem-iberia-club-avios/",
       "title": "Upgraded Points: Iberia Club Avios",
       "date": "2026-09-02"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/transfer-avios-between-accounts/",
       "title": "Upgraded Points: moving Avios",
       "date": "2026-04-07"
      }
     ]
    },
    "jetblue": {
     "book": {
      "zh": "捷藍航空和夥伴的獎勵票都在 jetblue.com 或 app 選「Use TrueBlue points」訂。可以兌換的夥伴有 United、卡達航空、阿提哈德航空、Icelandair、Condor 和中華航空（只能兌換），Cape Air 因系統更新暫停兌換、沒說何時恢復，新加坡航空和南非航空只能累積。夥伴獎勵票必須全用點數付，而且每個單程只能由同一家航空公司執飛，所以捷藍加夥伴的行程要分開訂。",
      "en": "JetBlue and partner awards book on jetblue.com or the app by choosing \"Use TrueBlue points\". You can redeem on United, Qatar Airways, Etihad, Icelandair, Condor and China Airlines (redeem only), while Cape Air redemptions are paused during a systems update with no end date, and Singapore Airlines and South African are earn-only. Partner awards must be paid fully in points and each one-way must be flown by a single airline, so a JetBlue plus partner trip needs separate bookings."
     },
     "fees": {
      "zh": "捷藍航空自營航班的獎勵票只付政府稅金：美國國內單程 US$5.60，國際線單程 US$5.60 到 US$161.50。夥伴獎勵票可能加收政府稅金和航空公司附加費，但沒有公布金額。透過電話或聊天客服訂位或改票，每人加收 US$25，Mosaic 會員免收。",
      "en": "JetBlue-operated awards carry only government taxes: US$5.60 one-way in the US and US$5.60 to US$161.50 one-way internationally. Partner awards may add government taxes and carrier-imposed fees, with no amounts published. Booking or changing by phone or chat adds US$25 per person, waived for Mosaic members."
     },
     "changes": {
      "zh": "2026 年 7 月 30 日起訂的獎勵票，Base 票種（Main Base、EvenMore Base、BlueFirst Base、Mint Base）改票或取消每人 US$150，要刷卡付，付完點數會退回；其他票種改退都不收費。夥伴獎勵票不能改，但在第一段起飛前取消，點數會退回，稅金則退成捷藍航空的旅遊抵用金。",
      "en": "For awards booked from July 30, 2026, Base fares (Main Base, EvenMore Base, BlueFirst Base and Mint Base) cost US$150 per person to change or cancel, paid by card, and the points are then put back; other JetBlue fares have no change or cancel fee. Partner awards can't be changed, but cancelling before the first flight returns the points, with taxes refunded as JetBlue travel credit."
     },
     "tips": [
      {
       "zh": "中華航空從美國飛台北（及以遠）的獎勵票可以在 jetblue.com 線上訂，但不能和捷藍航空的航班合成一張獎勵票。",
       "en": "China Airlines awards from the US to Taipei and beyond book online at jetblue.com, but can't be combined with JetBlue flights in one award."
      },
      {
       "zh": "夥伴獎勵票建議每個單程分開訂：不能改，但出發前取消點數全退。",
       "en": "Book partner awards as separate one-ways: they can't be changed, but each can be cancelled before departure for full points back."
      },
      {
       "zh": "Chase 和 Citi 1:1 轉（Citi 看卡別），Amex 250:200，Capital One 5:3。Points Pooling 可以讓 2 到 7 人共用一個點數池。",
       "en": "Chase and Citi transfer 1:1 (Citi depends on the card), Amex 250:200 and Capital One 5:3. Points Pooling lets 2 to 7 members share one balance."
      }
     ],
     "sources": [
      {
       "url": "https://www.jetblue.com/airline-partners",
       "title": "JetBlue: airline partners"
      },
      {
       "url": "https://www.jetblue.com/airline-partners/china-airlines",
       "title": "JetBlue: China Airlines"
      },
      {
       "url": "https://www.jetblue.com/airline-partners/qatar-airways",
       "title": "JetBlue: Qatar Airways"
      },
      {
       "url": "https://www.jetblue.com/airline-partners/cape-air",
       "title": "JetBlue: Cape Air"
      },
      {
       "url": "https://www.jetblue.com/flying-with-us/our-fares",
       "title": "JetBlue: fares"
      },
      {
       "url": "https://blog.flightsdummy.com/jetblue-trueblue-awards-points-flights-2026/",
       "title": "Flightsdummy",
       "date": "2026-09-09"
      }
     ]
    },
    "lifemiles": {
     "book": {
      "zh": "星空聯盟夥伴的獎勵票可以在 lifemiles.com 線上訂，但看到的獎勵位可能和其他星空聯盟計畫不太一樣。夥伴航班不能保留：付費的 Lock and Fly 只適用 Avianca 的航班。",
      "en": "Star Alliance partner awards book online at lifemiles.com, but the award space there can differ from what other Star Alliance programs see. Partner awards can't be held: the paid Lock and Fly hold works only on Avianca flights."
     },
     "fees": {
      "zh": "所有夥伴都不收燃油附加費。線上訂星空聯盟獎勵票，每張收 US$25。",
      "en": "No fuel surcharges on any partner. Each Star Alliance award booked online carries a US$25 fee per ticket."
     },
     "changes": {
      "zh": "星空聯盟獎勵票改日期收 US$150，而且要打客服或到售票處辦。退票手續費訂位時會顯示（每張大約 US$50 到 US$200），而且只有完全沒用過、一年內兌換的票才能退。LifeMiles+ 從 2026-06-26 起不再給新訂閱者免費改票和退票；在那之前就訂閱的人還能再享 12 個月。",
      "en": "Changing the date on a Star Alliance award costs US$150 and has to go through the call center or a sales office. Refunds carry a fee shown when you book (about US$50 to US$200 per ticket), and only fully unused tickets redeemed within the last year qualify. LifeMiles+ stopped giving free changes and cancellations to new subscribers from 2026-06-26; people who subscribed before then keep them for 12 months."
     },
     "tips": [
      {
       "zh": "不同搜尋模式結果會不一樣：預設的 Smart Search 不一定會顯示最便宜的獎勵票，長榮航空的航班也可能沒出現，所以要另外指定實際執飛的航空公司搜尋。",
       "en": "Results differ between search modes: the default Smart Search may not show the best-priced awards, and EVA Air flights can be missing, so also search by the specific operating airline."
      },
      {
       "zh": "要轉好幾次機的複雜行程，不適合用 LifeMiles，改用 Aeroplan 訂。",
       "en": "For complicated itineraries with several connections, book through Aeroplan instead of LifeMiles."
      }
     ],
     "sources": [
      {
       "url": "https://www.lifemiles.com/terms-conditions",
       "title": "LifeMiles: terms and conditions"
      },
      {
       "url": "https://ayuda.avianca.com/hc/en-us/articles/33913412478363-Do-I-have-to-pay-to-refund-a-ticket-redeemed-with-Lifemiles",
       "title": "Avianca: LifeMiles refunds",
       "date": "2026-03-03"
      },
      {
       "url": "https://onemileatatime.com/guides/redeem-lifemiles/",
       "title": "One Mile at a Time: LifeMiles guide",
       "date": "2026-01-17"
      },
      {
       "url": "https://frequentmiler.com/award-ticket-change-and-cancellation-fees-by-transfer-partner/",
       "title": "Frequent Miler: award change fees",
       "date": "2026-07-24"
      },
      {
       "url": "https://frequentmiler.com/lifemiles-eliminates-free-cancellation-benefit-for-new-subscribers/",
       "title": "Frequent Miler: LifeMiles+ change",
       "date": "2026-06-29"
      },
      {
       "url": "https://frequentmiler.com/avianca-sucks-some-of-the-life-out-of-lifemiles/",
       "title": "Frequent Miler: LifeMiles search",
       "date": "2026-05-01"
      }
     ]
    },
    "lufthansa": {
     "book": {
      "zh": "大部分星空聯盟夥伴可以線上訂，包括長榮航空、United、全日空、新加坡航空、土耳其航空、加拿大航空；World Award Flights 和嬰兒要有自己的座位，得透過 Miles & More 服務團隊訂。帳戶至少要有 1,500 哩才能訂，還要輸入寄到 email 的驗證碼（有時也要簡訊驗證碼）。漢莎航空、瑞士航空、奧地利航空、Lufthansa City、Air Dolomiti、Discover 每班價格不同，其他夥伴照固定價格表。",
      "en": "Most Star Alliance partners book online, including EVA Air, United, ANA, Singapore Airlines, Turkish Airlines and Air Canada; World Award Flights and an infant's own seat must go through the Service Team. You need at least 1,500 miles to book, plus a code sent by email (and sometimes by SMS) to confirm it's you. Lufthansa, SWISS, Austrian, Lufthansa City, Air Dolomiti and Discover are priced per flight, and other partners use a fixed chart."
     },
     "fees": {
      "zh": "每張獎勵票都要另付稅金、規費和航空公司附加費（燃油附加費會轉嫁），可能還有服務費。這些只能刷卡付，不能用哩程付。",
      "en": "Every award adds taxes, fees and airline surcharges (fuel surcharges are passed on), plus possible service charges. These are paid by credit card only, not with miles."
     },
     "changes": {
      "zh": "改票和退票只能打電話，固定價格表的夥伴獎勵票只能改日期和時間，每人每次 €50。起飛前取消，票價規則允許的話會退哩程和附加費，收該票價的手續費（至少 €50）；沒搭（no-show）就兩樣都拿不回來。漢莎、瑞士、奧地利航空的獎勵票照所訂票價的規則：2026-06-03 起部分航線上很多經濟艙、豪華經濟艙、商務艙 Flex 票可以免費退，頭等艙 Flex 收 €800，有些折扣商務艙票不能退。",
      "en": "Changes and cancellations are by phone only, and on fixed-chart partner awards only the date and time can change, for €50 per person. Cancelling before departure refunds the miles and surcharges if the fare allows, for the fare's fee (at least €50); a no-show loses both. Lufthansa, SWISS and Austrian awards follow the fare booked: since 2026-06-03 many Economy, Premium Economy and Business Flex fares refund free on some routes, First Flex costs €800, and some discounted Business fares can't be refunded."
     },
     "tips": [
      {
       "zh": "Amex、Chase、Citi、Capital One 都不能轉進 Miles & More，唯一的轉點夥伴是 Rove，所以哩程只能靠搭飛機、買哩程或美國聯名卡累積。",
       "en": "None of Amex, Chase, Citi or Capital One transfers to Miles & More; its only transfer partner is Rove, so the miles have to come from flying, buying miles or the US co-brand card."
      },
      {
       "zh": "台灣屬於「Central Asia/Far East」區，夥伴價格表上到北美的商務艙來回 170,000 哩，單程減半是 85,000 哩。",
       "en": "Taiwan is in the Central Asia/Far East zone, and partner business between there and North America costs 170,000 miles round trip, or half (85,000) one-way."
      },
      {
       "zh": "可以用自己帳戶的哩程幫親友訂獎勵票，不用跟著一起飛。",
       "en": "You can book awards for relatives or friends without flying with them, using miles from your own account."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260130023852/https://www.miles-and-more.com/de/en/general-information/terms-and-conditions/flight-awards.html",
       "title": "Miles & More: award terms (archived)"
      },
      {
       "url": "https://web.archive.org/web/20261003154218/https://www.miles-and-more.com/row/en/spend/flights.html",
       "title": "Miles & More: award flights (archived)"
      },
      {
       "url": "https://www.miles-and-more.com/content/dam/mmg/touchpoint/web/pdf/Flight_Awards_EN.pdf",
       "title": "Miles & More: award chart (PDF)",
       "date": "2026-03-03"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/best-ways-to-redeem-lufthansa-miles/",
       "title": "Upgraded Points: Miles & More guide",
       "date": "2026-06-10"
      },
      {
       "url": "https://upgradedpoints.com/news/miles-more-award-refund-fees/",
       "title": "Upgraded Points: award refund fees",
       "date": "2026-06-04"
      }
     ]
    },
    "qantas": {
     "book": {
      "zh": "qantas.com 可以線上訂澳洲航空、捷星航空，以及阿拉斯加航空、美國航空、國泰航空、日本航空、阿聯酋航空、英國航空、芬蘭航空和馬來西亞航空等夥伴；其他夥伴要打電話，電話訂位至少要在起飛前 24 小時。從台灣出發的 Classic Flight Reward 不能用電腦版網站線上訂，美國出發的可以。台北出發的獎勵票在網路上訂不了的話，打電話跟客服說明，並請他們免收電話訂位費。",
      "en": "qantas.com books Qantas, Jetstar and partners including Alaska, American, Cathay Pacific, JAL, Emirates, British Airways, Finnair and Malaysia Airlines online; other partners need a call, and phone bookings must be made at least 24 hours before departure. Classic Flight Rewards from Taiwan can't be booked online on desktop, while US departures can. If a Taipei-origin award won't book online, call, say so and ask the agent to waive the phone booking fee."
     },
     "fees": {
      "zh": "Qantas 獎勵票會加收「carrier charges」（航空公司附加費）：澳洲航空自家航班很高（商務艙、頭等艙更高），阿聯酋航空也高，日本航空比較低，美國航空只收稅金；不過這些比較是 2019 年的數字。美國國內線搭美國航空或阿拉斯加航空，顯示的稅費是 US$6 到 US$18。打電話訂國際線獎勵票，每位乘客要付 7,700 點的 Reward Assistance Fee（訂位協助費）。",
      "en": "Qantas adds carrier charges to award bookings: they run high on Qantas's own flights (more in business and first) and on Emirates, lower on JAL, and on American only taxes are passed on, though these comparisons date from 2019. US domestic awards on American and Alaska show US$6 to US$18 in taxes and fees. Booking an international award by phone costs a Reward Assistance Fee of 7,700 points per passenger."
     },
     "changes": {
      "zh": "改票每位乘客 5,000 點，取消 6,000 點；打電話改票還要加收服務費，商務艙和頭等艙除外。夥伴航班要改，必須在第一段航班起飛前至少 24 小時；起飛前 24 小時內還是可以打給當地的澳洲航空辦公室取消，但一旦開始搭乘，就不會退點數。在美國購買的獎勵票，如果是出發前一週以上訂的，開票後 24 小時內可以免費取消。",
      "en": "A change costs 5,000 points and a cancellation 6,000 points per passenger, and changes made by phone add a service fee except on business and first bookings. Changes to partner flights must be made at least 24 hours before the first flight; inside 24 hours of departure you can still cancel by calling your local Qantas office, and nothing is refunded once travel starts. Awards bought in the US can be canceled free within 24 hours of ticketing if booked at least a week before departure."
     },
     "tips": [
      {
       "zh": "獎勵機票只能訂給自己和符合資格的家人，不能幫朋友訂。點數可以在線上免費轉給家人的帳戶，最少 1,500 點。",
       "en": "Flight Rewards can be booked only for yourself and eligible family members, not friends. You can move points to a family member's account online at no charge, from 1,500 points."
      },
      {
       "zh": "每個單程依距離計價，中途停留超過 24 小時就算新的一段，所以中停不是免費的。例外是 oneworld Classic Flight Reward：除了澳洲航空，還要搭至少兩家 oneworld 航空公司，依總距離按來回計價，最多可以免費中停五次。",
       "en": "Each one-way trip is priced by distance and any stop over 24 hours starts a new trip, so stopovers are not free. The exception is a oneworld Classic Flight Reward on at least two oneworld airlines besides Qantas: it is priced as a round trip on total distance and allows up to five free stopovers."
      },
      {
       "zh": "Capital One 哩程 1:1 轉 Qantas；Citi ThankYou 點數則是 1:1 或 1:0.7，看你的 Citi 卡而定。",
       "en": "Capital One miles transfer to Qantas at 1:1; Citi ThankYou points transfer at 1:1 or 1:0.7, depending on your Citi card."
      }
     ],
     "sources": [
      {
       "url": "https://www.qantas.com/en-au/frequent-flyer/join/terms-conditions",
       "title": "Qantas: Frequent Flyer terms",
       "date": "2026-08-27"
      },
      {
       "url": "https://help.qantas.com/support/s/article/Booking-a-partner-airline-Reward-flight-online",
       "title": "Qantas help: partner awards online",
       "date": "2025-06-10"
      },
      {
       "url": "https://help.qantas.com/support/s/article/Countries-territories-you-can-book-from-for-Commercial-and-Classic-Flight-Reward-bookings-using-desktop",
       "title": "Qantas help: desktop booking by country",
       "date": "2025-07-28"
      },
      {
       "url": "https://help.qantas.com/support/s/article/Cancelling-or-changing-a-Reward-flight-booking",
       "title": "Qantas help: changing or canceling",
       "date": "2023-11-27"
      },
      {
       "url": "https://www.pointhacks.com.au/using-qantas-points-surcharge-comparison/",
       "title": "Point Hacks: surcharge comparison",
       "date": "2026-06-11"
      },
      {
       "url": "https://www.pointhacks.com.au/qantas/how-to-book-classic-flight-reward-seat/",
       "title": "Point Hacks: booking Classic Flight Rewards",
       "date": "2025-07-28"
      }
     ]
    },
    "qatar": {
     "book": {
      "zh": "卡達航空、寰宇一家和其他合作航空的獎勵票都能在 qatarairways.com 線上訂，包括捷藍航空、維珍澳洲航空、曼谷航空、LATAM，以及 2026 年 5 月起加入的菲律賓航空；網站上查不到的，可以填表單請他們協助。Gold 以下只能幫自己、My List 上最多 4 位 Privilege Club 會員，或 Family & Friends 裡最多 6 位非會員開票。Gold 和 Platinum 會員可以幫任何人訂，線上或打電話都行。",
      "en": "Qatar, oneworld and other partner awards book online at qatarairways.com, including JetBlue, Virgin Australia, Bangkok Airways, LATAM and, since May 2026, Philippine Airlines; for anything the site can't show there is a request form. Below Gold you can ticket only yourself, up to 4 Privilege Club members on your My List, or a Family & Friends group of up to 6 non-members. Gold and Platinum members can book for anyone, online or by phone."
     },
     "fees": {
      "zh": "卡達航空自家航班的獎勵票會加收「訂位費」（航空公司附加費），金額看航線和艙等，通常不算高：2026 年一張 95,000 Avios 的邁阿密-杜哈-曼谷 Qsuites 單程，稅費共 US$298.10。合作航空的獎勵票要付該航空公司的稅金和附加費。2025 年 11 月起，商務艙 saver（U 艙）獎勵票提前選位要付費，除非你有 oneworld Sapphire 或 Emerald 等級。",
      "en": "Awards on Qatar's own flights add a carrier-imposed booking fee that depends on route and cabin, usually moderate: a 95,000-Avios Miami-Doha-Bangkok Qsuites one-way in 2026 came to US$298.10 in taxes and fees. Partner awards add the operating airline's taxes and surcharges. Since Nov 2025, saver (U-class) business awards charge for picking seats in advance unless you hold oneworld Sapphire or Emerald."
     },
     "changes": {
      "zh": "起飛前 3 小時以前都能改票或退票：離起飛超過 24 小時每人 US$25，3 到 24 小時之間每人 US$100；Gold 和 Platinum 主會員本人免費，但同一筆訂位的其他乘客照付。起飛前 3 小時內就視同 no-show（未登機）：Avios 和現金都拿不回來，只退機場稅和政府稅。Privilege Deals 的訂位要改，只能取消後重新上網訂。",
      "en": "You can change or cancel up to 3 hours before departure: US$25 per passenger if you are more than 24 hours out, or US$100 between 3 and 24 hours; Gold and Platinum main members pay nothing, but other passengers on their booking still pay. Inside 3 hours it counts as a no-show: the Avios and cash are lost and only airport and government taxes come back. To change a Privilege Deals booking you must cancel it and rebook online."
     },
     "tips": [
      {
       "zh": "My List 或 Family & Friends 要提早設好：帳戶開滿 30 天才能加 My List 成員，加進去的人 6 個月內不能移除。到 2026 年 9 月中，卡達航空已大致取消「要先搭過他們的航班或持有聯名卡」這條額外規定，但還是有可能碰到。",
       "en": "Set up My List or Family & Friends before you need it: your account must be at least 30 days old before you can add My List members, and they stay locked in for 6 months. By mid-September 2026 Qatar had largely dropped the extra rule that you first fly with it or hold a co-brand card, but you may still run into it."
      },
      {
       "zh": "菲律賓航空的獎勵票現在可以直接在 qatarairways.com 線上訂，多了一條經馬尼拉跨太平洋的選擇：商務艙單程 18,000 到 154,500 Avios，附加費不高。",
       "en": "Philippine Airlines awards now book online at qatarairways.com, which gives a transpacific option via Manila: business costs 18,000 to 154,500 Avios one-way, with mild surcharges."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20261004005430/https://www.qatarairways.com/en/Privilege-Club/terms-and-conditions.html",
       "title": "Qatar: Privilege Club terms",
       "date": "2026-10-04"
      },
      {
       "url": "https://web.archive.org/web/20260213004555/https://www.qatarairways.com/en/Privilege-Club/redeem-avios/award-ticket-fees.html",
       "title": "Qatar: award ticket fees",
       "date": "2026-02-13"
      },
      {
       "url": "https://web.archive.org/web/20260413225409/https://www.qatarairways.com/en/Privilege-Club/fare-conditions.html",
       "title": "Qatar: fare conditions",
       "date": "2026-04-13"
      },
      {
       "url": "https://onemileatatime.com/guides/airline-award-ticket-fees/",
       "title": "One Mile at a Time: award ticket fees",
       "date": "2026-09-10"
      },
      {
       "url": "https://onemileatatime.com/news/qatar-airways-restricts-award-bookings-others-absurd-new-rule/",
       "title": "One Mile at a Time: Qatar booking for others",
       "date": "2026-07-21"
      },
      {
       "url": "https://frequentmiler.com/30-transfer-bonus-to-qatar-avios-from-citi-thankyou/",
       "title": "Frequent Miler: Citi to Qatar bonus",
       "date": "2026-10-03"
      }
     ]
    },
    "saudia": {
     "book": {
      "zh": "可以打給 Saudia 的 Guest Care Center 用哩程訂獎勵票。開票後可以在 app 或官網的「Trips」線上改票或取消。",
      "en": "You can redeem miles for awards by calling Saudia's Guest Care Center. Reward tickets can be changed or cancelled online under \"Trips\" in the app or on the website."
     },
     "fees": {
      "zh": "獎勵票要付稅金、服務費、政府規費和航空公司附加費，全部由會員自付。",
      "en": "Reward tickets carry taxes, service charges, government fees and carrier-imposed charges, and you pay all of them."
     },
     "changes": {
      "zh": "獎勵票自開票起一年內有效，可以付費退票或改訂。飛了一部分的票，沒飛的航段可以退；過期的票不能退，退回的哩程如果已經過期也會被扣掉。",
      "en": "Reward tickets are valid for one year from issue and can be refunded or rebooked for a fee. Unused sectors of a partly flown ticket can be refunded, but expired tickets can't, and refunded miles that have already expired are removed."
     },
     "tips": [
      {
       "zh": "Amex、Chase、Capital One 等美國主要信用卡點數都不能轉進 AlFursan。",
       "en": "You can't transfer points to AlFursan from Amex, Chase, Capital One or the other major US card programs."
      },
      {
       "zh": "Reward+ 的位子多很多，但哩程是 Reward 的兩倍；頭等艙只賣 Reward 價。",
       "en": "Reward+ seats are much easier to find but cost twice the Reward price, and First is sold only at Reward prices."
      }
     ],
     "sources": [
      {
       "url": "https://www.saudia.com/en-US/information/terms-and-conditions/alfursan",
       "title": "Saudia: AlFursan terms"
      },
      {
       "url": "https://www.saudia.com/en-US/loyalty/about-alfursan-program/alfursan-miles/miles-redemption",
       "title": "Saudia: miles redemption"
      },
      {
       "url": "https://www.saudia.com/en-US/loyalty/manage-reward-ticket",
       "title": "Saudia: manage reward ticket"
      },
      {
       "url": "https://www.saudia.com/en-US/earn-and-redeem",
       "title": "Saudia: earn and redeem"
      },
      {
       "url": "https://10xtravel.com/saudia-alfursan-miles-program-guide/",
       "title": "10xTravel: AlFursan guide",
       "date": "2025-10-21"
      },
      {
       "url": "https://10xtravel.com/saudia-alfursan-miles-award-charts/",
       "title": "10xTravel: AlFursan award charts",
       "date": "2025-05-16"
      }
     ]
    },
    "singapore": {
     "book": {
      "zh": "新加坡航空自家的獎勵票（Saver、Advantage、Access）在 singaporeair.com 訂，星空聯盟夥伴正分批開放線上訂；找不到某個夥伴或航線時，填訂位表單或打 KrisFlyer 會員服務中心，這時不收線下手續費。印尼航空、馬來西亞航空、維珍澳洲航空、吉祥航空的獎勵票要透過會員服務中心訂，而且分開開票。2026 年 7 月起帳戶裡至少要有 1,000 哩才能搜尋，候補只限新加坡航空自家航班。",
      "en": "Singapore Airlines awards (Saver, Advantage, Access) book on singaporeair.com, and Star Alliance awards are being added online in stages; if a partner or route doesn't show, use the reservation form or call KrisFlyer Membership Services, and the offline fee is waived. Garuda, Malaysia Airlines, Virgin Australia and Juneyao awards go through Membership Services on separate tickets. Since July 2026 you need at least 1,000 miles in your account to search, and waitlisting works only on Singapore Airlines flights."
     },
     "fees": {
      "zh": "夥伴獎勵票會轉嫁燃油附加費，很多長程夥伴收得很高。打電話或到櫃台訂位、改票，加收 US$25 或 2,500 哩；網站辦不了的情況和 PPS Club 會員免收。",
      "en": "Partner awards pass on fuel surcharges, which can be high on many long-haul partners. Booking or changing by phone or at an office adds US$25 or 2,500 miles, waived when it can't be done online and for PPS Club members."
     },
     "changes": {
      "zh": "新加坡航空自家航班改日期：Saver 收 US$25，Advantage 和 Access 免費；改航線、艙等或獎勵類型收 US$25；夥伴獎勵票改日期、航線、航班或航空公司收 US$50。取消退哩程 Saver 收 US$75，Advantage 和 Access 收 US$50，而且票要完全沒用過。沒搭（no-show）另收經濟艙 US$100、商務或頭等最高 US$300；夥伴的票飛過一段後就不能改。",
      "en": "On Singapore Airlines flights, a date change costs US$25 on Saver and nothing on Advantage or Access, and a route, cabin or award-type change costs US$25; a date, route, flight or carrier change on a partner award costs US$50. Cancelling for a miles refund costs US$75 on Saver or US$50 on Advantage and Access, and only fully unused tickets qualify. A no-show adds US$100 in economy and up to US$300 in business or first, and a partly flown partner ticket can't be changed."
     },
     "tips": [
      {
       "zh": "從西雅圖出發，SEA-SIN 直飛商務艙 Saver 單程 112,500 哩（Advantage 148,000 哩），這是 2025-11-01 生效的美西到新加坡價格。",
       "en": "From Seattle, the nonstop SEA-SIN flight costs 112,500 miles one-way in Saver business (148,000 Advantage), the USA West Coast to Singapore price on the chart in effect since 2025-11-01."
      },
      {
       "zh": "Amex、Chase、Capital One 都是 1:1 轉入，Citi 高階卡也是 1:1（免年費的 Citi 卡是 1:0.7）。哩程在賺到後 36 個月到期，有活動也不會延長（可以付費延期：每 10,000 哩 US$12 延 6 個月，菁英會員延 12 個月），所以找到位子再轉點。",
       "en": "Amex, Chase and Capital One transfer 1:1, and so does Citi from premium cards (1:0.7 from no-annual-fee Citi cards). Miles expire 36 months after you earn them and activity doesn't reset that (you can pay US$12 per 10,000 miles to extend them six months, or 12 months for elite members), so transfer only after you find the seat."
      },
      {
       "zh": "哩程不能合併：只能幫自己或最多 5 位兌換提名人（redemption nominee）訂，加入後 6 個月不能換，刪除要付哩程或錢。信用卡點數只能轉進持卡人自己的 KrisFlyer 帳戶，不能轉給別人。",
       "en": "Miles can't be pooled: you can book only for yourself or up to five redemption nominees, who can't be changed for six months and cost miles or money to remove. Card points can only go into the KrisFlyer account of the person they belong to."
      }
     ],
     "sources": [
      {
       "url": "https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/forms-and-fees/service-fees/",
       "title": "KrisFlyer: service fees"
      },
      {
       "url": "https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/termsconditions-kf/",
       "title": "KrisFlyer: terms and conditions"
      },
      {
       "url": "https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/use-miles/redeem-miles/award-tickets-on-star-alliance-airlines/",
       "title": "KrisFlyer: Star Alliance awards"
      },
      {
       "url": "https://www.singaporeair.com/en_UK/us/ppsclub-krisflyer/use-miles/redeem-miles/",
       "title": "KrisFlyer: redeem miles"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/how-to-redeem-singapore-airlines-krisflyer-miles/",
       "title": "Upgraded Points: KrisFlyer guide",
       "date": "2026-10-06"
      },
      {
       "url": "https://thepointsguy.com/loyalty-programs/ultimate-guide-singapore-krisflyer",
       "title": "The Points Guy: KrisFlyer guide",
       "date": "2026-09-07"
      }
     ]
    },
    "smiles": {
     "book": {
      "zh": "GOL 和夥伴的獎勵票都在 Smiles 官網訂。夥伴包括美國航空、法國航空、荷蘭皇家航空、英國航空、Iberia、卡達航空、阿聯酋航空、阿提哈德航空、土耳其航空、加拿大航空、全日空、大韓航空、香港航空和阿拉斯加航空。哩程不夠、而且出發還有 15 天以上時，GOL 獎勵票可以付 R$50 保留 3 天。",
      "en": "GOL and partner awards book on the Smiles website. Partners include American, Air France, KLM, British Airways, Iberia, Qatar Airways, Emirates, Etihad, Turkish, Air Canada, ANA, Korean Air, Hong Kong Airlines and Alaska. If you are short of miles and travel is 15 or more days out, a GOL award can be held for 3 days for R$50."
     },
     "fees": {
      "zh": "Smiles 的會員規則允許收取兌換、開票、取消和退款的手續費。",
      "en": "The program rules let Smiles charge fees for redemption, issuance, cancellation and refunds."
     },
     "changes": {
      "zh": "夥伴獎勵票除非該航空公司同意，否則不能改；取消要先付手續費才退哩程。GOL 獎勵票取消費國內線 R$400、國際線 US$180 到 US$310。GOL 自營航班的獎勵票只能在官網改日期或時間，每人每段國內線 R$450、南美洲內 US$185、其他國際線 US$210。",
      "en": "Partner award tickets can't be changed unless the partner allows it, and cancelling returns the miles only after the fees are paid. Cancelling a GOL award costs R$400 domestic or US$180 to US$310 international. GOL-operated awards can change date or time only on the website, for R$450 domestic, US$185 within South America or US$210 on other international flights, per segment per passenger."
     },
     "tips": [
      {
       "zh": "價格是浮動的，沒有固定獎勵表，同一條航線一天之內可能從 7,000 哩跳到 40,000 哩，多查幾次。",
       "en": "Prices are dynamic with no fixed chart, and the same route can swing from 7,000 to 40,000 miles within a day, so search more than once."
      },
      {
       "zh": "一個帳戶每個日曆年除了本人，最多可以幫 25 個不同的人開票。",
       "en": "One account can issue tickets for the holder plus up to 25 different people per calendar year."
      }
     ],
     "sources": [
      {
       "url": "https://www.smiles.com.br/portal/companhias-aereas-parceiras",
       "title": "Smiles: partner airlines"
      },
      {
       "url": "https://www.smiles.com.br/portal/demais-cias-aereas",
       "title": "Smiles: other partners"
      },
      {
       "url": "https://www.smiles.com.br/regulamento-do-programa-smiles-novo",
       "title": "Smiles: program rules",
       "date": "2023-12-11"
      },
      {
       "url": "https://www.smiles.com.br/servicos-GOL",
       "title": "Smiles: GOL services"
      },
      {
       "url": "https://cartoeseviagens.com.br/cancelamento-reembolso-smiles",
       "title": "Cartões e Viagens",
       "date": "2026-09-15"
      },
      {
       "url": "https://viajanamilha.com.br/mapa-da-milha/dicas-do-especialista/smiles-como-funciona-vale-a-pena",
       "title": "Viaja na Milha",
       "date": "2026-10-07"
      }
     ]
    },
    "turkish": {
     "book": {
      "zh": "土耳其航空自家航班的獎勵票可以在官網或 App 訂，星空聯盟夥伴則是登入後從「Miles Transactions」頁面線上訂，或打電話訂。夥伴搜尋常出錯，所以夥伴的位子常常要打電話；Azul、GOL 等其他夥伴只能打客服或到售票處訂。來回票要在伊斯坦堡中途停留，也得打電話訂。",
      "en": "Awards on Turkish's own flights book on the website or app, and Star Alliance awards book online from the Miles Transactions page after you log in, or by phone. The partner search is buggy, so partner seats often need a call, and other partners such as Azul and GOL book only through the call center or a sales office. A stopover in Istanbul on a round-trip award also has to be booked by phone."
     },
     "fees": {
      "zh": "除了機場稅和法定規費，土耳其航空自家航班和夥伴獎勵票都要付燃油附加費。沒有列出訂位或電話訂位的手續費。",
      "en": "Expect fuel surcharges on top of airport taxes and statutory charges, on Turkish's own flights and on partner awards. No booking or phone fee is listed."
     },
     "changes": {
      "zh": "原開票日起一年內可以改日期、改航線或退票退哩程，線上或打客服都能辦。國際線每次改票或退票收 US$70，沒搭（no-show）後要收 US$170。單程票只要飛過任何一段，就不能退。",
      "en": "You can change the date or route, or cancel for a miles refund, within one year of the original issue date, online or through the call center. Each change or refund on an international award costs US$70, or US$170 after a no-show. A one-way award can't be refunded once any leg has been flown."
     },
     "tips": [
      {
       "zh": "土耳其航空自家航班的 Promotion 商務艙，土耳其到北美或遠東（台灣算遠東）單程 65,000 哩，但按航段計價，在伊斯坦堡轉機就要再加一段的價格。搭星空聯盟夥伴從遠東到北美的商務艙，單程 130,000 哩。",
       "en": "Saver (Promotion) business on Turkish flights costs 65,000 miles one-way between Türkiye and North America or the Far East, which includes Taiwan, but pricing is per segment, so connecting in Istanbul adds a second segment's price. Star Alliance partner business between the Far East and North America costs 130,000 miles one-way."
      },
      {
       "zh": "帳戶要先完成驗證（例如自己用獎勵票飛過一次），才能幫家人朋友訂獎勵票。",
       "en": "Your account must be verified, for example by flying an award ticket in your own name, before you can book awards for family or friends."
      },
      {
       "zh": "Amex、Chase、Citi、Capital One 四家裡，只有 Citi 和 Capital One 能轉進 Miles&Smiles。Capital One 是 1:1；Citi 高階 ThankYou 卡是 1:1，一般卡是 1:0.7。",
       "en": "Of Amex, Chase, Citi and Capital One, only Citi and Capital One transfer to Miles&Smiles. Capital One is 1:1; Citi is 1:1 from premium ThankYou cards and 1:0.7 from non-premium ones."
      }
     ],
     "sources": [
      {
       "url": "https://web.archive.org/web/20260611202139/https://www.turkishairlines.com/en-gb/miles-and-smiles/redeem-miles/redeem-miles-on-flights/award-travel-terms-conditions/",
       "title": "Turkish: award terms (archived)"
      },
      {
       "url": "https://web.archive.org/web/20261012031351/https://www.turkishairlines.com/en-us/miles-and-smiles/redeem-miles/redeem-miles-on-flights/turkish-airlines-award-tickets/",
       "title": "Turkish: award tickets and chart (archived)"
      },
      {
       "url": "https://web.archive.org/web/20260831141506/https://www.turkishairlines.com/en-us/miles-and-smiles/account-verification/",
       "title": "Turkish: account verification (archived)"
      },
      {
       "url": "https://upgradedpoints.com/travel/airlines/best-ways-to-redeem-turkish-airlines-miles-smiles/",
       "title": "Upgraded Points: Miles&Smiles",
       "date": "2026-10-08"
      },
      {
       "url": "https://onemileatatime.com/guides/redeem-turkish-airlines-miles/",
       "title": "One Mile at a Time: Miles&Smiles guide",
       "date": "2026-02-09"
      },
      {
       "url": "https://onemileatatime.com/guides/stopover-rules-award-tickets/",
       "title": "One Mile at a Time: stopover rules",
       "date": "2026-09-24"
      }
     ]
    },
    "united": {
     "book": {
      "zh": "在 united.com 或 United App 訂獎勵票免費，合作夥伴的航班應該都能在網站上訂；長榮航空也可以打電話訂。部分非星空聯盟夥伴的航班要先保留 24 小時，等對方航空確認後 United 會寄 email 通知。立榮航空（長榮的區域機隊）執飛的航班不能用 MileagePlus 哩程訂。",
      "en": "Booking on united.com or the United app is free, and partner awards should all be bookable there; EVA Air awards can also be booked by phone. Some non-Star Alliance partner flights need a 24-hour hold, and United emails you once the partner confirms. Flights operated by UNI Air, EVA's regional fleet, can't be booked with MileagePlus miles."
     },
     "fees": {
      "zh": "不收燃油附加費，只付稅金和規費。在美國和加拿大打電話訂要 US$25（Premier Platinum 和 1K 免收），在 City Ticket Office 訂 US$10，在機場訂 US$50；美加以外的地區收費不同。",
      "en": "No fuel surcharges: you pay only taxes and fees. Booking by phone in the US and Canada costs US$25 (waived for Premier Platinum and 1K), US$10 at a City Ticket Office and US$50 at the airport; fees differ outside the US and Canada."
     },
     "changes": {
      "zh": "獎勵票改票不收費，取消後哩程免費退回帳戶。沒搭（no-show）的話要付 US$125 才能拿回哩程。獎勵票目前仍開在非 basic 的訂位艙等，所以新的 basic 票價限制暫時不適用。",
      "en": "Award changes are free, and a cancelled award puts the miles back in your account for free. A no-show costs US$125 to get the miles back. Awards still book into regular (non-basic) fare classes, so the new basic-fare restrictions don't apply to them for now."
     },
     "tips": [
      {
       "zh": "最多 5 位 MileagePlus 會員可以免費合併哩程，也能用來訂長榮航空、全日空、加拿大航空、新加坡航空等夥伴。你放進去的哩程，退出後會留在共用帳戶裡。",
       "en": "Up to 5 MileagePlus members can pool miles for free and spend them on partners including EVA Air, ANA, Air Canada and Singapore Airlines. Miles you put in stay in the pool if you leave."
      },
      {
       "zh": "因為取消免費，看到可能會用的長榮或 United 獎勵位可以先訂下來，等於免費保留。但記得出發前取消，沒搭的話要 US$125 才拿得回哩程。",
       "en": "Because cancelling is free, booking EVA or United award space you might use works like a free hold. Cancel before departure, though: a no-show costs US$125 to get the miles back."
      },
      {
       "zh": "Excursionist Perk（多城市獎勵票裡送一段免費單程）從 2025-08-21 起取消，新訂位和更改既有訂位都不再適用，規劃行程時別再算進去。",
       "en": "The Excursionist Perk (a free one-way inside a multi-city award) ended on 2025-08-21 for new award bookings and for changes to existing ones, so don't plan around it."
      }
     ],
     "sources": [
      {
       "url": "https://www.united.com/en/us/fly/mileageplus/award-redeposit-fees.html",
       "title": "United: award fees"
      },
      {
       "url": "https://www.united.com/en/us/fly/mileageplus/partners/earn-miles-on-eva-air.html",
       "title": "United: EVA Air"
      },
      {
       "url": "https://www.united.com/en/us/fly/mileageplus/partners/airline.html",
       "title": "United: partner airlines"
      },
      {
       "url": "https://www.united.com/en/us/fly/mileageplus/whats-new.html",
       "title": "United: What's new",
       "date": "2025-05-22"
      },
      {
       "url": "https://www.united.com/en/us/fly/mileageplus/miles-pooling.html",
       "title": "United: miles pooling"
      },
      {
       "url": "https://frequentmiler.com/united-mileageplus-complete-guide/",
       "title": "Frequent Miler: United guide",
       "date": "2026-05-04"
      }
     ]
    },
    "velocity": {
     "book": {
      "zh": "維珍澳洲航空、卡達航空、新加坡航空、加拿大航空、United、全日空和香港航空，可以在 Velocity 或維珍澳洲航空的官網和 app 線上訂。維珍航空、南非航空、海南航空和首都航空要打給會員客服中心訂。夥伴航班的線上訂位在出發前 24 小時截止。線上訂免手續費；打電話訂，維珍澳洲國內和短程每人 AU$40 或 5,200 點，可以線上訂的夥伴每人 AU$70 或 8,800 點，只能電話訂的夥伴不收。",
      "en": "Virgin Australia, Qatar Airways, Singapore Airlines, Air Canada, United, ANA and Hong Kong Airlines book online on the Velocity and Virgin Australia website and app. Virgin Atlantic, South African, Hainan and Capital Airlines need a call to the Membership Contact Centre. Online partner bookings close 24 hours before departure. Booking online is free; by phone it costs AU$40 or 5,200 points per person for Virgin Australia domestic and short-haul, AU$70 or 8,800 points for partners you could book online, and nothing for phone-only partners."
     },
     "fees": {
      "zh": "商務艙會加固定的航空公司附加費：卡達航空 US$85 到 US$200，新加坡航空 4,200 哩以內 US$120、更遠 US$200，卡達航空執飛的維珍澳洲長程航班 US$200。United、維珍航空、全日空、加拿大航空和香港航空沒有公布金額，只說可能另有稅費。",
      "en": "In business, Velocity adds fixed carrier charges: US$85 to US$200 on Qatar Airways, US$120 on Singapore Airlines flights up to 4,200 miles or US$200 on longer ones, and US$200 on Virgin Australia long-haul flights operated by Qatar. For United, Virgin Atlantic, ANA, Air Canada and Hong Kong Airlines it publishes no amounts, only that other fees and taxes may apply."
     },
     "changes": {
      "zh": "國際線和夥伴的 Reward Seat 改票或退票，每人每筆訂位 7,500 點或 AU$60；改票要在該航段起飛 24 小時前提出，退票要在第一段起飛 24 小時前，費用從退款裡扣。改票要找客服，全用點數付的票可以線上取消。往返或經過美國的訂位如果在出發 7 天以前訂，訂後 24 小時內打電話取消免費。",
      "en": "International and partner Reward Seats cost 7,500 points or AU$60 per person per booking to change (at least 24 hours before that flight) or to cancel (at least 24 hours before the first flight, taken out of the refund). Changes go through the contact center, while seats paid fully with points can be cancelled online. Bookings to, from or via the US made 7 or more days before departure can be cancelled free within 24 hours by phone."
     },
     "tips": [
      {
       "zh": "截至 2026 年 10 月 2 日，只有住在澳洲、紐西蘭、巴布亞紐幾內亞、斐濟和幾個太平洋島國的人能加入，Capital One 也不能轉 Velocity，所以除非你已經有帳戶，這些結果只能參考。",
       "en": "As of October 2, 2026, only residents of Australia, New Zealand, Papua New Guinea, Fiji and a few Pacific islands can join, and Capital One does not transfer to Velocity, so treat these results as reference unless you already have an account."
      },
      {
       "zh": "停留超過 24 小時、中途換艙等，或混搭不同獎勵表的航空公司，Velocity 就會每段分開計價。",
       "en": "A layover over 24 hours, a cabin change, or mixing airlines from different award charts makes Velocity price each sector separately."
      },
      {
       "zh": "維珍澳洲、卡達和新加坡航空的獎勵位最好找；United 和加拿大航空很少放位，商務艙和跨太平洋航線尤其難。",
       "en": "Virgin Australia, Qatar and Singapore Airlines have the best award availability; United and Air Canada release few award seats, especially in business and across the Pacific."
      }
     ],
     "sources": [
      {
       "url": "https://www.velocityfrequentflyer.com/flying-status/airline-partners",
       "title": "Velocity: airline partners"
      },
      {
       "url": "https://www.velocityfrequentflyer.com/member-support/terms-conditions",
       "title": "Velocity: terms",
       "date": "2026-10-02"
      },
      {
       "url": "https://www.virginaustralia.com/au/en/travel-info/flying-with-us/fare-types/velocity-reward-seat/",
       "title": "Virgin Australia: Reward Seat rules"
      },
      {
       "url": "https://www.pointhacks.com.au/velocity-reward-seats-in-2026/",
       "title": "Point Hacks: Reward Seats in 2026",
       "date": "2026-09-22"
      },
      {
       "url": "https://www.pointhacks.com.au/velocity/international-airline-redemptions/",
       "title": "Point Hacks: partner redemptions",
       "date": "2026-07-27"
      },
      {
       "url": "https://www.capitalone.com/learn-grow/money-management/venture-miles-transfer-partnerships/",
       "title": "Capital One: transfer partners"
      }
     ]
    },
    "virginatlantic": {
     "book": {
      "zh": "維珍航空自家航班，以及達美航空、法國航空、荷蘭皇家航空、大韓航空的獎勵票，可以在 virginatlantic.com 用「Search for Reward Flights」線上訂；全日空和中華航空要打電話請 Flying Club 團隊訂。只有合作航空自己飛的航班才能訂，合作航空的艙位有時要向對方申請，最多可能要 48 小時才確認。用點數訂的機票要改，得打電話。",
      "en": "Virgin Atlantic flights and partner awards on Delta, Air France, KLM and Korean Air book online at virginatlantic.com with Search for Reward Flights; ANA and China Airlines awards go through the Flying Club team by phone. Only flights the partner itself operates qualify, and partner seats may need to be requested from the partner, which can take up to 48 hours. Changes to points bookings are made by phone."
     },
     "fees": {
      "zh": "維珍航空自家航班的附加費很高：美國飛倫敦商務艙單程在 2025 年從 US$255 漲到 US$586，2026 年英國出發的 Saver Upper Class 來回每人又多了 £400 以上。法航、荷航，以及達美往返美國和英國或歐洲的航班也有附加費，全日空的則不高。打電話訂位不收手續費。",
      "en": "Surcharges on Virgin Atlantic flights are high: a US to London business one-way went from US$255 to US$586 in 2025, and a 2026 increase added over £400 per person to a UK-departure Saver Upper Class return. Air France and KLM flights, and Delta flights between the US and the UK or Europe, also carry surcharges, while ANA's are mild. There is no phone booking fee."
     },
     "changes": {
      "zh": "每次改票或取消，英國出發的行程每人 £70，其他地區 US$100（或等值當地貨幣）；如果付的稅費比手續費低，可以直接放棄稅費。在去程起飛前超過 24 小時取消，點數、稅金和附加費都會退回（扣掉手續費）；24 小時內取消只退政府稅金。2025 年 11 月 5 日起的訂位，改票只重新計價有改的那一段，Gold 會員改維珍航空自家獎勵航班的日期免費。",
      "en": "Each change or cancellation costs £70 per person on trips that start in the UK, or US$100 (or the local equivalent) elsewhere; if your taxes are less than the fee, you can give them up instead. Cancel more than 24 hours before the outbound flight to get points, taxes and surcharges back minus the fee; inside 24 hours only government taxes come back. On bookings made from 5 Nov 2025 a change reprices only the changed sector, and Gold members change dates free on Virgin-operated rewards."
     },
     "tips": [
      {
       "zh": "全日空商務艙單程：日本到美西 52,500 點，日本到台灣 22,500 點，只能打電話訂。合作航空的獎勵票每段分開計價，所以西雅圖經東京到台北要付兩段加起來的點數。",
       "en": "ANA business costs 52,500 points one-way between Japan and the western US and 22,500 between Japan and Taiwan, and is booked by phone only. Partner awards are charged per sector, so Seattle to Tokyo to Taipei costs both amounts."
      },
      {
       "zh": "線上訂亞洲，大韓航空的價格比較低：美西到韓國商務艙 85,000 點，達美 Delta One 超過 5,000 英里的航班則要 130,000 到 165,000 點。大韓航空 2026 年 12 月 10 日到 26 日從美國出發的航班不開放獎勵票。",
       "en": "For Asia online, Korean Air has the better chart: US West Coast to Korea in business is 85,000 points, versus 130,000 to 165,000 for Delta One flights over 5,000 miles. Korean Air blacks out US departures from 10 to 26 Dec 2026."
      },
      {
       "zh": "打電話給 Flying Club 可以把獎勵票保留一天，有時最多兩天，等信用卡點數轉過來時很好用。",
       "en": "Flying Club will hold an award by phone for one day, sometimes up to two, which helps while card points transfer."
      }
     ],
     "sources": [
      {
       "url": "https://www.virginatlantic.com/flying-club/spend-points/reward-seats",
       "title": "Virgin Atlantic: reward seats"
      },
      {
       "url": "https://www.virginatlantic.com/policies/virgin-atlantic-flying-club-terms-and-conditions-effective-from-30th-october-2024",
       "title": "Virgin Atlantic: Flying Club terms"
      },
      {
       "url": "https://www.virginatlantic.com/flying-club/airline-partners/korean-air",
       "title": "Virgin Atlantic: Korean Air awards"
      },
      {
       "url": "https://www.virginatlantic.com/flying-club/airline-partners/all-nippon-airways",
       "title": "Virgin Atlantic: ANA awards"
      },
      {
       "url": "https://onemileatatime.com/guides/virgin-atlantic-flying-club-points/",
       "title": "One Mile at a Time: Flying Club guide",
       "date": "2025-12-28"
      },
      {
       "url": "https://www.headforpoints.com/2026/04/03/virgin-atlantic-increases-charges-on-saver-rewards/",
       "title": "Head for Points: Saver reward charges",
       "date": "2026-04-03"
      }
     ]
    }
   }
  };
  const ALS = [['star', '星空聯盟'], ['oneworld', '寰宇一家'], ['skyteam', '天合聯盟'], ['none', '其他計畫']];
  const L = x => (x ? (LANG === 'en' ? x.en : x.zh) || '' : '');
  const has = k => !!NOTES.programs[k];
  let open = null, query = '';

  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#3E3A39" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M5 3.8h10.5l3.5 3.5V20.2H5z" fill="#FCF1D3"/><path d="M15.5 3.8v3.5H19"/><path d="M8 11h8M8 14.2h8M8 17.4h5"/></g></svg>';

  function section(title, x) {
    const v = L(x);
    return v ? '<div class="nt-s"><b>' + esc(t(title)) + '</b><p>' + esc(v) + '</p></div>' : '';
  }
  function bodyHtml(k) {
    const n = NOTES.programs[k];
    const tips = (n.tips || []).map(L).filter(Boolean);
    return section('怎麼訂', n.book) + section('燃油附加費和手續費', n.fees) + section('改票和退票', n.changes) +
      (tips.length ? '<div class="nt-s"><b>' + esc(t('小提醒')) + '</b><ul>' + tips.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' : '') +
      ((n.sources || []).length ? '<div class="nt-src"><b>' + esc(t('來源')) + '</b>' + n.sources.map(s => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        esc(s.title || s.url.replace(/^https?:\/\/(web\.archive\.org\/web\/\d+\/)?(https?:\/\/)?(www\.)?/, '').split('/')[0]) + (s.date ? ' (' + esc(s.date) + ')' : '') + '</a>').join('') + '</div>' : '');
  }
  // the library: programs by alliance, each folded open on tap; a box narrows the list by name
  function draw(body) {
    const q = query.trim().toLowerCase();
    const keys = Object.keys(PROGRAMS).filter(has).filter(k => !q || (prog(k).name + ' ' + PROGRAMS[k][1] + ' ' + k).toLowerCase().includes(q));
    const groups = ALS.map(([al, name]) => [name, keys.filter(k => PROGRAMS[k][2] === al)]).filter(g => g[1].length);
    body.innerHTML =
      '<p class="note0 nt-intro">' + esc(t('每一句都查過計畫官網或 2025 到 2026 年的里程網站，再另找一個來源核對；兩邊對不上的就沒寫進來。規則常改，訂位前請到官網確認。')) +
      (NOTES.as_of ? ' ' + esc(t('查證日期：{0}', NOTES.as_of)) : '') + '</p>' +
      '<div class="field nt-find"><label for="nt-q">' + esc(t('找計畫')) + '</label><input id="nt-q" value="' + esc(query) + '" placeholder="' + esc(t('例：Aeroplan、長榮')) + '" autocomplete="off" enterkeyhint="search"></div>' +
      (groups.length ? groups.map(([name, ks]) => '<h3 class="nt-h">' + esc(t(name)) + '</h3>' + ks.map(k => {
        const p = prog(k);
        return '<details class="acard nt-p" data-k="' + k + '"' + (open === k ? ' open' : '') + '><summary>' + logo(p.code) + '<span class="nt-n">' + esc(p.name) +
          '<small>' + esc(PROGRAMS[k][1]) + '</small></span><span class="nt-c" aria-hidden="true">＋</span></summary>' + bodyHtml(k) + '</details>';
      }).join('')).join('') : '<p class="note0">' + esc(t('找不到這個計畫。')) + '</p>');
  }
  // in a card's details: the first sentence of each of the three points that matter before transferring points,
  // and a link to the rest (the whole text made a card longer than the flights in it)
  const first = s => { const m = /^.+?(。|\.(?=\s+[A-Z(])|$)/.exec(s); return m ? m[0] : s; };
  function detailsBlock(src) {
    const n = NOTES.programs[src];
    if (!n) return '';
    const line = (title, x) => (L(x) ? '<li><b>' + esc(t(title)) + '</b>' + esc(first(L(x))) + '</li>' : '');
    return '<div class="nt-card"><b>' + esc(t('訂位須知')) + '</b><ul>' + line('怎麼訂：', n.book) + line('燃油附加費：', n.fees) + line('改票退票：', n.changes) + '</ul>' +
      '<a href="#/notes?k=' + src + '">' + esc(t('看 {0} 的全部須知', prog(src).name)) + '</a></div>';
  }

  addFeature({
    id: 'notes',
    title: '訂位須知',
    route: /^#\/notes(?:\?k=([a-z0-9]+))?$/,
    nav: { tab: 'me', order: 40, label: '訂位須知', icon: ICON, href: '#/notes', summary: () => (Object.keys(NOTES.programs).length ? t('{0} 個計畫', Object.keys(NOTES.programs).length) : '') },
    css: `
.nt-intro{margin:4px 0 10px}
.nt-find{margin-bottom:6px}
.nt-h{font-size:16px;margin:16px 2px 6px;font-weight:400}
.nt-p{padding:0;margin:8px 0;overflow:hidden;scroll-margin-top:calc(var(--hh) + 10px)}
.nt-p summary{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;list-style:none;min-height:52px}
.nt-p summary::-webkit-details-marker{display:none}
.nt-p summary .lg{width:26px;height:26px;border-radius:6px}
.nt-p .nt-n{flex:1;min-width:0;font-size:16px}
.nt-p .nt-n small{display:block;font-size:12px;color:var(--ink2)}
.nt-p .nt-c{font-size:18px;color:var(--ink2);transition:transform .2s}
.nt-p[open] .nt-c{transform:rotate(45deg)}
.nt-p[open] summary{border-bottom:2px dashed var(--ink)}
.nt-s{padding:8px 14px 0}
.nt-s b,.nt-src b{display:block;font-size:13px;color:var(--ink2);margin-bottom:2px}
.nt-s p{margin:0;font-size:14px;line-height:1.6}
.nt-s ul{margin:0;padding-left:18px;font-size:14px;line-height:1.6}
.nt-src{padding:8px 14px 12px;font-size:12px;display:flex;flex-wrap:wrap;gap:2px 10px}
.nt-src b{flex-basis:100%}
.nt-src a{color:var(--ink2);word-break:break-all}
.nt-card{border-top:2px dashed var(--ink);margin-top:10px;padding-top:8px;font-size:13px}
.nt-card ul{margin:4px 0 6px;padding-left:18px;line-height:1.55}
.nt-card li b{margin-right:2px}
.nt-card a{font-size:13px}
`,
    en: {
      '訂位須知': 'Booking notes',
      '怎麼訂': 'How to book',
      '燃油附加費和手續費': 'Surcharges and fees',
      '改票和退票': 'Changes and cancellations',
      '小提醒': 'Tips',
      '來源': 'Sources',
      '每一句都查過計畫官網或 2025 到 2026 年的里程網站，再另找一個來源核對；兩邊對不上的就沒寫進來。規則常改，訂位前請到官網確認。':
        "Every sentence comes from the program's own pages or 2025-2026 points sites and was checked against a second source; anything the two did not agree on was left out. Rules change often, so confirm on the program's site before booking.",
      '查證日期：{0}': 'Checked {0}.',
      '找計畫': 'Find a program',
      '例：Aeroplan、長榮': 'e.g. Aeroplan, EVA',
      '星空聯盟': 'Star Alliance',
      '寰宇一家': 'oneworld',
      '天合聯盟': 'SkyTeam',
      '其他計畫': 'Other programs',
      '找不到這個計畫。': 'No program by that name.',
      '怎麼訂：': 'Booking: ',
      '燃油附加費：': 'Surcharges: ',
      '改票退票：': 'Changes: ',
      '看 {0} 的全部須知': 'All notes for {0}',
      '{0} 個計畫': '{0} programs',
    },
    show(m, body) {
      if (m[1] && has(m[1])) open = m[1];
      draw(body);
      if (m[1] && has(m[1])) { const el = body.querySelector('.nt-p[data-k="' + m[1] + '"]'); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 0); }
      if (!body.dataset.wired) {
        body.dataset.wired = '1';
        body.addEventListener('input', e => {
          if (e.target.id !== 'nt-q') return;
          query = e.target.value;
          const at = e.target.selectionStart;
          draw(body);
          const q = $('#nt-q');
          q.focus();
          try { q.setSelectionRange(at, at); } catch {}
        });
        body.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('.nt-p'); if (d) open = d.open ? d.dataset.k : open === d.dataset.k ? null : open; }, true);
      }
    },
    onDetails(art, box) {
      if (box.querySelector('.nt-card')) return;
      const html = detailsBlock(art.dataset.src);
      if (html) box.insertAdjacentHTML('beforeend', html);
    },
  });
})();
