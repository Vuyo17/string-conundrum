// isiXhosa translation of the 'Looping Through Strings' module.
//
// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,
// then merged over the English base by `getModuleContent`. Partial by
// design: `code`, `output`, `value` and table rows are omitted so they keep
// their English/original value, and `null` holds an array slot open.
//
// Needs a human read before students see it.

export const loopingModuleXh = {
  "title": "Ukujikeleza NgeXStrings",
  "level": "Ophakathi",
  "outcomes": [
    "Iterate phezu oonobumba ngqo kunye for ch in s",
    "Iterate over positions with for i kwi range(len(s))",
    "Khetha isimbo esifanelekileyo kwingxaki ethile",
    "Bhala iipateni zokuqala zemigangatho yokuhlolwa: ukubala, ukuhluza, ukwakha"
  ],
  "learnSections": [
    {
      "title": "Iindlela ezimbini zokuhamba ngestring",
      "blocks": [
        {
          "text": "I-Python inikezela ngeendlela ezimbini ze-loop kwi-string. **Ngobuntu** ikunika umlinganiswa ngamnye ngokulandelana, olula kwaye ucocekile. **Ngokuma** ikunika i-index nganye, oyisebenzisayo ukukhangela abalinganiswa, ebalulekileyo xa i-POSITION ibalulekile okanye ufuna abamelwane."
        },
        {
          "caption": "Zombini iiloops zityelela umlinganiswa ngamnye kanye kanye, yaye lo mzekelo weeleta eziphindwe kabini uvela ngqo kwiingqungquthela zekhosi."
        },
        {
          "title": "Impazamo eqhelekileyo: umda uphantsi komnye",
          "text": "I-`range(len(word))` ichanekile: ivelisa u-0 ukuya ku-len - 1. Ukubhala i-`range(len(word) + 1)` kubangela i-IndexError kwi-pass yokugqibela; i-`range(len(word) - 1)` ishiya umlinganiswa wokugqibela."
        },
        {
          "title": "Nguwuphi umgangatho wokukhetha",
          "text": "Ufuna nje oonobumba? Sebenzisa `for ch in s`. Ufuna izikhombisi, umlinganiswa ngamnye wesibini, okanye uhamba umva? Sebenzisa `range`, umzekelo `range(len(s)-1, -1, -1)` utyelela string ngasemva."
        }
      ]
    },
    {
      "title": "Iindlela ezintathu zokuqala",
      "blocks": [
        {
          "text": "Phantse yonke imibuzo yokuhlolwa kwe\"write a program, and you may NOT use count()/find()/replace()\" yenye yeendlela ezintathu, okanye indibaniselwano yazo."
        },
        {
          "caption": "Imodeli yokubala: i-accumulator kunye nokuthelekisa."
        },
        {
          "caption": "Ipateni yokwakha: ngenxa yokuba i-strings ayitshintshi, yenza enye entsha ene +=."
        },
        {
          "caption": "Ipateni yesikhundla: esetyenziswa kumsebenzi we-Wordle, apho oonobumba kufuneka balungelelaniswe."
        },
        {
          "title": "Indlela oku kuhlolwa ngayo",
          "text": "Amaphepha adlulileyo acela oku: ukubala ukuvela kweleta nganye yestring enye ngaphakathi kwenye, ukuhlela iileta nge\"_\", ukuguqula isivakalisi sesivakalisi ngesivakalisi, nokwenza igama ngalinye libe likhulu, konke kwakhiwe kwezi ndlela zintathu."
        }
      ]
    },
    {
      "title": "Ngoxa loops phezu strings",
      "blocks": [
        {
          "text": "Ngexesha elithile i-loop yenza ukuhamba okufanayo ne-index elawulwa ngesandla. iimviwo ziyayithanda kuba i-loop CONDITION yindawo ahlala kuyo amaqhinga."
        },
        null,
        {
          "title": "Impazamo edla ngokwenzeka: isifo esiyeka kwangethuba",
          "text": "I-`while i < len(s) - 1` ibonakala ingenabungozi kodwa ilahla uphawu lokugqibela. Thelekisa imeko kunye neseti yee-indices ezisebenzayo (0 ukuya ku-len-1) ngaphambi kokuba uphendule nawuphi na umbuzo wokuqikelela ukuphuma."
        }
      ]
    },
    {
      "title": "Izikhokelo ezibalulekileyo",
      "blocks": [
        {
          "items": [
            "I-`for ch in s` ityelela abalinganiswa; I-`for i in range(len(s))` ityelela izikhundla.",
            "I-`range(len(s))` igubungela ngokuchanekileyo ii-indices ezisemthethweni, ngaphandle kwe- +1 kunye ne- -1.",
            "BHALELWA nge-accumulator, YAKHWA nge-`result += ...`, SCAN nge-index.",
            "I-\"From first principles\" ithetha ezi modeli, hayi i-count(), i-find() okanye i-replace().",
            "Ngelixa loops, khangela imeko ngokuchasene index yokugqibela esebenzayo phambi kokuba uqikelele output."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukubala ngaphandle kwecount()",
      "intro": "Imodeli yokubala esemgangathweni yokuhlolwa, elandelwa kwigama lokwenene.",
      "steps": [
        {
          "text": "Qalisa i-accumulator kwi-zero, uze utyelele oonobumba bonke besicatshulwa ngokulandelelana."
        },
        {
          "text": "Ii-indices 1 ne-2 zombini ziyi-'e', ngoko ke i-accumulator inyuka iye kwi-2. I-'b' kunye ne-'k' ziyatyelelwa, kodwa isitatimende se-if siyazigatya."
        },
        {
          "text": "Imidlalo eseleyo ihlala kwi-indices 4, 5 kunye ne-7. I-5 'e' iyonke."
        }
      ]
    },
    {
      "title": "Ukwakha i-string ehlaziyiweyo",
      "intro": "Ipateni yokwakha: ekubeni ii-strings zingatshintshi, zikhulise umlinganiswa omtsha ngomlinganiswa.",
      "steps": [
        {
          "text": "umlinganiswa wokuqala `b` ayikho kwi \"an\", ngoko ugcinwa: ngaphandle yi \"b\"."
        },
        {
          "text": "Wonke umlinganiswa oseleyo ngu `a` okanye `n`, onke amalungu e-redakt string, ngoko ngamnye wongeza umgca ongezantsi endaweni yoko."
        },
        {
          "text": "I-string yokuqala ayichatshazelwa kuyo yonke into; kuphela i-string entsha eyakhiwe. Le yindlela ekhuselekileyo yokungaguquki kwetekisi ye-\"edit\"."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "I-Loop Walker",
    "description": "I-loop yinto nje elawulwayo yokuhamba ngokusebenzisa ii-indices. Khetha i-string kunye ne-index ukubona indlela yokuhamba a ye-loop eyenza ukuba ifikelele kuyo.",
    "defaults": {
      "text": "ukuhlaziywa"
    }
  }
};
