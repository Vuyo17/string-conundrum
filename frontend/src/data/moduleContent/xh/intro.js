// isiXhosa translation of the "Introduction to Strings" module.
//
// Partial by design: `getModuleContent` deep-merges this over the English base,
// so anything omitted here (ids, `code`, `string`, `highlight`, `state`,
// `output`, visualiser defaults) keeps its English/original value. Never
// translate a `code` block, a Python keyword, or a method name — the student
// has to type those exactly, and their lecturer and exam use the English terms.

export const introModuleXh = {
  "title": "Intshayelelo kwiiString",
  "level": "Osaqalayo",
  "outcomes": [
    "Yenza ii-string literal usebenzisa iingcaphuno ezinye okanye ezimbini",
    "Sebenzisa ii-escape sequence ezifana no-\\n no-\\\\ ngokuchanekileyo",
    "Guqula phakathi kweempawu namanani e-Unicode ngo-ord() no-chr()",
    "Dibanisa, phinda uze ulinganise iistring ngo-+, * kunye no-len()"
  ],
  "learnSections": [
    {
      "title": "Yintoni ngokwenene istring",
      "blocks": [
        {
          "text": "I-**string** lulandelelwano lweempawu: oonobumba, amanani, izithuba nezimboli, ngolandelelwano olumiselweyo. Cinga ngayo njengeentsimbi ezisecingweni, apho intsimbi nganye luphawu olunye, kwaye ucingo lugcina ulandelelwano lwazo."
        },
        {
          "caption": "Iingcaphuno ezinye nezimbini zenza uhlobo olufanayo lwestring."
        },
        {
          "title": "I-string literal",
          "text": "Umbhalo obhalwe ngqo kwikhowudi, usongelwe kwiingcaphuno ezinye okanye ezimbini ezihambelanayo. Ngaphandle kweengcaphuno, iPython icinga ukuba umbhalo ligama le-variable."
        },
        {
          "title": "Iingcaphuno ngaphakathi kweengcaphuno",
          "text": "Istring esifana no-`it's cold` sonakalisa iingcaphuno ezinye, kuba iPython icinga ukuba istring siyaphela kwi-apostrophe. Songela kwiingcaphuno ezimbini endaweni yoko: `\"it's cold\"`."
        }
      ]
    },
    {
      "title": "Ii-escape sequence: iimpawu ezizifihlileyo",
      "blocks": [
        {
          "text": "Ezinye iimpawu azinakuchwethezwa ngqo ngaphakathi kwestring. I-**escape sequence** iqala nge-backslash kwaye imele uphawu OLUNYE kuphela: u-`\\n` ngumgca omtsha kwaye u-`\\\\` yi-backslash enye."
        },
        null,
        {
          "title": "Impazamo eqhelekileyo: ukubala ii-escape sequence njengeempawu ezimbini",
          "text": "Uvavanyo lwethiyori luthanda ukubuza i-`len()` yestring esiqulethe u-`\\n`. Kwikhowudi ibonakala ngathi zizimboli ezimbini, kodwa istring sigcina uphawu olunye lomgca omtsha. I-`len(\"Cape\\nTown\")` ngu-9."
        }
      ]
    },
    {
      "title": "Ngaphantsi: i-Unicode, u-ord() no-chr()",
      "blocks": [
        {
          "text": "Ikhompyutha ayizigcini oonobumba; igcina amanani. I-**Unicode** yindlela evunyelweneyo yokudibanisa amanani nezimboli: u-65 ngu-`A`, u-66 ngu-`B`, kwaye u-97 ngu-`a`. Imisebenzi emibini ihamba phakathi kwala mahlabathi mabini."
        },
        {
          "head": [
            "Intetho",
            "Isiphumo",
            "Kutheni"
          ],
          "rows": [
            ["ord(\"A\")", "65", "Uphawu ukuya kwinani le-Unicode"],
            ["chr(97)", "'a'", "Inani le-Unicode ukuya kuphawu"],
            ["chr(ord(\"a\") + 2)", "'c'", "Iimpawu zinokuhanjiswa ngebalo"],
            ["ord(\"a\") - ord(\"A\")", "32", "Oonobumba abancinci bahlala kwiindawo ezingama-32 emva kwabakhulu"]
          ]
        },
        {
          "text": "Yiyo loo nto ibalo leempawu lisebenza: ukuhambisa oonobumba ngokongeza kwixabiso labo le-`ord()` yiyo kanye indlela imisebenzi yecypher edumileyo kule khosi isonjululwa ngayo."
        },
        {
          "title": "Amanani abonakala ngathi ngumbhalo",
          "text": "I-`int(\"1234\")` iguqula istring lamanani ibe linani lokwenene; i-`str(1234)` ihamba ngakolunye uhlangothi. Ude uguqule, u-`\"10\"` ziimpawu ezimbini nje, kwaye asoze alingane nenani u-`10`."
        }
      ]
    },
    {
      "title": "Ukwakha nokulinganisa: +, * kunye no-len()",
      "blocks": [
        null,
        {
          "title": "Impazamo eqhelekileyo: ukulindela ukuba u-* enze ibalo kwiistring zamanani",
          "text": "U-`'23.4' * 2` ngu-`'23.423.4'`, hayi u-46.8. Iingcaphuno zenza ukuba ibe yistring, kwaye u-* uphinda iistring, akasoze adibanise amanani ayo. Lo mgibe uvele kuvavanyo lwethiyori."
        },
        {
          "title": "Impazamo eqhelekileyo: u-+ phakathi kwestring nenani",
          "text": "U-`\"Score: \" + 10` uvelisa i-TypeError. Guqula kuqala: `\"Score: \" + str(10)`."
        }
      ]
    },
    {
      "title": "Izinto eziphambili",
      "blocks": [
        {
          "items": [
            "Iistring lulandelelwano olucwangcisiweyo lweempawu, olusongelwe kwiingcaphuno ezihambelanayo.",
            "I-escape sequence efana no-`\\n` okanye u-`\\\\` LUPHAWU OLUNYE, hayi ezimbini.",
            "U-`ord()` uguqula uphawu lube linani le-Unicode; u-`chr()` uguqula inani libuyele kuphawu.",
            "U-`+` udibanisa iistring, u-`*` uyaziphinda, kwaye u-`len()` ubala iimpawu zazo.",
            "Istring lamanani sisengu-string: `\"10\" != 10` ude uguqule ngo-`int()`."
          ]
        }
      ]
    }
  ],
  "examples": [
    {
      "title": "Ukubala iimpawu kwi-escape sequence",
      "intro": "Into ethandwayo kuvavanyo lwethiyori: sinde kangakanani istring esiqulethe i-escape sequence?",
      "steps": [
        {
          "text": "Kwikhowudi, i-literal ibonakala njengezimboli ezine: A, backslash, n, B."
        },
        {
          "text": "Kodwa iPython iguqula u-`\\n` ibe luphawu olunye lomgca omtsha njengoko ifunda ikhowudi. Istring esigciniweyo ngu-A, umgca omtsha, B."
        },
        {
          "text": "U-`len(s)` ubala iimpawu ezigciniweyo, ngoko uprinta u-3."
        }
      ]
    },
    {
      "title": "Ukuhambisa unobumba ngo-ord() no-chr()",
      "intro": "Ipatheni ye-cypher: hambisa uphawu phambili kwi-alfabhethi usebenzisa inani lalo le-Unicode.",
      "steps": [
        {
          "text": "U-`ord(\"c\")` ukhangela inani le-Unicode lika-`c`, elingu-99."
        },
        {
          "text": "Ukongeza u-1 kunika u-100, libalo nje lamanani apheleleyo."
        },
        {
          "text": "U-`chr(100)` uguqula ubuyele kuphawu: `d`. Yonke i-alfabhethi ngamanani alandelelanayo."
        }
      ]
    }
  ],
  "visualizer": {
    "title": "Umhloli weempawu",
    "description": "Uphawu ngalunye kwistring luhlala kwindawo enenombolo. Chwetheza istring kunye ne-index ukubona indlela iPython efikelela ngayo kuphawu ngalunye, kwaye imodyuli elandelayo igubungela oku ngokuzeleyo.",
    "defaults": {
      "text": "njani"
    }
  }
};
