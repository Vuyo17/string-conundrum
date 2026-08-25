// isiXhosa translation of the 'Looping Through Strings' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output` and `value` are omitted so they keep their
// English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const loopingModuleXh = {
  "title": "Ukujikeleza kwiistring",
  "level": "Ophakathi",
  "prerequisite": "Ukuthelekisa iiString",
  "outcomes": [
    "Iterate ngaphezulu kweempawu ngqo kunye for ch in s",
    "Iterate phezu kwezithuba nge for i kwi range(len(s))",
    "Khetha isitayile esifanelekileyo kwingxaki ethile",
    "Bhala imimiselo yokuqala ye-exam-standard: bala, hlunga, yakha"
  ],
  "learnSections": [
    {
      "title": "Iindlela ezimbini zokuhamba ngestring",
      "blocks": [
        {
          "text": "I-Python inikezela ngeendlela ezimbini ze-loop kwi-string. **Ngobuntu** ikunika umlinganiswa ngamnye ngokulandelana, olula kwaye ucocekile. **Ngokuma** ikunika i-index nganye, oyisebenzisayo ukukhangela abalinganiswa, ebalulekileyo xa i-POSITION ibalulekile okanye ufuna abamelwane."
        },
        {
          "caption": "Bobabini iloops ityelela umlinganiswa ngamnye kanye kanye, yaye lo mzekelo weeleta eziphindwe kabini uvela ngqo kwiingxoxo zenkqubo."
        },
        {
          "title": "Impazamo eqhelekileyo: umda uphantsi komnye",
          "text": "I-`range(len(word))` ichanile: ivelisa u-0 ukuya ku-len - 1. Ukubhala i-`range(len(word) + 1)` kubangela i-IndexError kwi-pass yokugqibela; i-`range(len(word) - 1)` iwele umlinganiswa wokugqibela."
        },
        {
          "title": "Yiyiphi indlela oza kuyikhetha",
          "text": "Kufuneka nje oonobumba? Sebenzisa i`for ch in s`. Kufuneka ii-index, zonke iimpawu zesibini, okanye ukuhamba umva? Sebenzisa i`range`, umzekelo `range(len(s)-1, -1, -1)` utyelela istring ngokubuyela umva."
        }
      ]
    },
    {
      "title": "Iindlela ezintathu zokuqala",
      "blocks": [
        {
          "text": "Phantse yonke imibuzo yohlolo lwe\"write a program, and you may NOT use count()/find()/replace()\" yenye yeendlela ezintathu, okanye umxube wazo."
        },
        {
          "caption": "Umzekelo wokubala: umqokeleli kunye nokuthelekisa."
        },
        {
          "caption": "Ipateni yokwakha: kuba ii-strings azitshintshi, yenza enye entsha ene +=."
        },
        {
          "caption": "Ipateni yesikhundla: esetyenziswa kumsebenzi weWordle, apho kufuneka kubekho oonobumba."
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Amaphepha adlulileyo acela: ukubala ukuvela kweleta nganye yestring ngaphakathi kwenye, ukuhlela iileta nge\"_\", ukujika umongo ube ngumlinganiswa nomlinganiswa, nokufakela igama ngalinye, konke kwakhiwe kwezi ndlela zintathu."
        }
      ]
    },
    {
      "title": "Ngelixa loops phezu strings",
      "blocks": [
        {
          "text": "Ngexesha elithile i-loop yenza ukuhamba okufanayo ne-index elawulwa ngesandla."
        },
        null,
        {
          "title": "Impazamo edla ngokwenzeka: imeko eyaphela kwangethuba",
          "text": "`while i < len(s) - 1` ibonakala ingenabungozi kodwa ilahlekiswa ngumlinganiswa wokugqibela. Thelekisa imeko kunye neseti yeenkcukacha ezifanelekileyo (0 ukuya ku-len-1) ngaphambi kokuba uphendule nayiphi na imibuzo-exposure-the-output."
        }
      ]
    },
    {
      "title": "Iimpawu eziphambili",
      "blocks": [
        {
          "items": [
            "I-`for ch in s` ityelela iimpawu; i-`for i in range(len(s))` ityelela izikhundla.",
            "I-`range(len(s))` igubungela ngokuchanekileyo ii-indices ezisemthethweni, ngaphandle kwe-+1 kunye ne- -1.",
            "UBALA nge-accumulator, WAKHA nge-`result += ...`, Khangela nge-index.",
            "\"From first principles\" ithetha ezi modeli, hayi count(), find() okanye replace().",
            "Ngelixa loops, khangela imeko ngokuchasene index yokugqibela esebenzayo phambi kokuxela output."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukubala ngaphandle kwecount()",
      "intro": "Umzekelo wokubala oqhelekileyo, owenziwe ngegama lokwenene.",
      "steps": [
        {
          "text": "Qalisa i-accumulator kwi-zero, uze u tyelele zonke iimpawu zetekisi ngokulandelelana."
        },
        {
          "text": "Iindawo 1 no-2 zombini zingu 'e', ngoko ke i-accumulator inyuka iye kwi-2. Ne-'b' ne-'k' ziyatyelelwa, kodwa isivakalisi se-if siyazityeshela."
        },
        {
          "text": "Imidlalo eseleyo ihlala kwiinkcukacha 4, 5 no 7."
        }
      ]
    },
    {
      "title": "Ukwakha i-string ehlaziyiweyo",
      "intro": "Umzekelo wokwakha: ekubeni ii-strings zingatshintshi, zikhule uphawu olutsha ngomlinganiswa.",
      "steps": [
        {
          "text": "umlinganiswa wokuqala `b` ayikho kwi \"an\", ngoko ke kugcinwa: ngaphandle yi \"b\"."
        },
        {
          "text": "Wonke umlinganiswa oseleyo ngu `a` okanye `n`, onke amalungu e-redakt string, ngoko ngamnye wongeza umgca wesiseko endaweni yoko."
        },
        {
          "text": "I-string yokuqala ayichatshazelwa kuyo yonke into; kuphela i-string entsha eyakhiwe. Le yindlela ekhuselekileyo yokungaguquki kwetekisi ye-\"edit\"."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Umhambi we-Loop",
    "description": "I-loop yinto nje yokuhamba elawulwayo kwiinkcukacha. Khetha i-string kunye ne-index ukubona indlela yokuhamba a ye-loop eyenza ukuba ifike kuyo."
  }
};
