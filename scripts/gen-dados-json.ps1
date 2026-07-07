# Gera dados-audiencias.json (base consolidada para análise no Claude) a partir
# de src/data/games.ts. Rode após qualquer mudança nos dados:
#   powershell -File scripts/gen-dados-json.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$gt = Join-Path $root "src\data\games.ts"
$out = Join-Path $root "dados-audiencias.json"
$content = [System.IO.File]::ReadAllText($gt)

function PNum($s){ [double]::Parse($s, [Globalization.CultureInfo]::InvariantCulture) }
function ParseBody($body){
  $obj=[ordered]@{}
  foreach($m in [regex]::Matches($body,'(\w+)\s*:\s*(\{[^}]*\}|-?[0-9.]+)')){
    $k=$m.Groups[1].Value; $v=$m.Groups[2].Value
    if($v.StartsWith('{')){
      $d=[regex]::Match($v,'dom:\s*(-?[0-9.]+)').Groups[1].Value
      $i=[regex]::Match($v,'ind:\s*(-?[0-9.]+)').Groups[1].Value
      $obj[$k]=[ordered]@{dom=(PNum $d);ind=(PNum $i)}
    } else { $obj[$k]=(PNum $v) }
  }
  $obj
}
function ParseBlock($name){
  $map=@{}
  $m=[regex]::Match($content,"export const $name[^=]*=\s*\{(.*?)\n\};",'Singleline')
  if($m.Success){ foreach($line in ($m.Groups[1].Value -split "`n")){ $em=[regex]::Match($line,'"([^"]+)":\s*\{(.*)\}\s*,?\s*$'); if($em.Success){$map[$em.Groups[1].Value]=(ParseBody $em.Groups[2].Value)} } }
  $map
}
$amazon=ParseBlock 'AMAZON_EXTRA_METRICS'; $youtube=ParseBlock 'YOUTUBE_EXTRA_METRICS'; $record=ParseBlock 'RECORD_EXTRA_METRICS'; $globo=ParseBlock 'GLOBO_EXTRA_METRICS'

$gamesRx=[regex]'\["Brasileirão",\s*(\d+),\s*"([^"]*)",\s*(\d+),\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\]'
$jogos=@()
foreach($m in $gamesRx.Matches($content)){
  $ano=[int]$m.Groups[1].Value;$fase=$m.Groups[2].Value;$rod=[int]$m.Groups[3].Value
  $mand=$m.Groups[4].Value;$vis=$m.Groups[5].Value;$det=$m.Groups[6].Value
  $data=$m.Groups[7].Value;$dia=$m.Groups[8].Value;$hora=$m.Groups[9].Value
  $audS=$m.Groups[10].Value;$pntS=$m.Groups[11].Value
  $aud= if($audS -eq 'n/a'){$null}else{[int]($audS -replace '\.','')}
  $pnt= if($pntS -eq 'n/a'){$null}else{PNum ($pntS -replace ',','.')}
  $ex=$null
  switch($det){
    'Amazon'{if($amazon.ContainsKey($data)){$ex=$amazon[$data]}}
    'YouTube'{if($youtube.ContainsKey($data)){$ex=$youtube[$data]}}
    'Record'{if($record.ContainsKey($data)){$ex=$record[$data]}}
    'Globo'{$gk="$ano-$rod-$mand-$vis";if($globo.ContainsKey($gk)){$ex=$globo[$gk]}}
  }
  $principal= if($det -in @('Globo','Record','SporTV','Premiere')){'pontos'}else{'espectadores'}
  $jogos+=[ordered]@{ano=$ano;rodada=$rod;fase=$fase;data=$data;dia=$dia;horario=$hora;mandante=$mand;visitante=$vis;detentor=$det;audiencia_pessoas=$aud;pnt_pontos=$pnt;metrica_principal=$principal;extra_metrics=$ex}
}

function V($d,$i){ [ordered]@{domicilio=$d;individuo=$i} }
$tabela=[ordered]@{
  descricao="Valor do ponto no IBOPE: pessoas por ponto de audiência, por praça e ano. PNT = painel nacional consolidado (15 regiões metropolitanas)."
  "2025"=[ordered]@{PNT=(V 270631 692281);SP=(V 77488 199313);CAM=(V 8497 21982);RJ=(V 48836 120893);BH=(V 21482 54854);VIT=(V 7203 18142);POA=(V 15584 37647);CUR=(V 12352 31671);FLO=(V 5182 12734);GOI=(V 9639 24639);DF=(V 9994 26385);SAL=(V 13231 31896);FOR=(V 13232 35119);REC=(V 13768 35202);BEL=(V 7412 21687);MAN=(V 6729 20117)}
  "2026"=[ordered]@{PNT=(V 277669 699961);SP=(V 78780 199632);CAM=(V 8760 22271);RJ=(V 49778 122053);BH=(V 22184 55330);VIT=(V 7310 18461);POA=(V 15960 37513);CUR=(V 12511 32039);FLO=(V 5672 13640);GOI=(V 10109 25019);DF=(V 10033 26505);SAL=(V 13793 32968);FOR=(V 13722 35676);REC=(V 14117 35792);BEL=(V 7765 22460);MAN=(V 7168 20595)}
}
$doc=[ordered]@{
  descricao="Base consolidada de audiências do Brasileirão (2025 e 2026) — material de suporte para análise. Gerado a partir de src/data/games.ts do dashboard FFU."
  notas=@(
    "audiencia_pessoas: audiência absoluta em espectadores (indivíduos), quando disponível.",
    "pnt_pontos: pontos de audiência PNT, quando disponível.",
    "metrica_principal: 'pontos' para Globo/Record/SporTV/Premiere (TV), 'espectadores' para Amazon/YouTube (streaming).",
    "extra_metrics: Amazon (peak/streams/liveMinutes/totalViewers), YouTube (peak/alcance), Record (pontos por praça), Globo (pontos domiciliar+individual por praça).",
    "Conversão pontos->espectadores (Globo, validado com erro <0,04%): espectadores = Soma(pts_individual_praca x valor_individuo_praca[ano]) usando tabela_valor_ponto_ibope. Pontos PNT domiciliar = Soma(pts_domiciliar_praca x peso_praca), peso = domicilio_praca/domicilio_PNT."
  )
  tabela_valor_ponto_ibope=$tabela
  total_jogos=$jogos.Count
  jogos=$jogos
}
[System.IO.File]::WriteAllText($out, ($doc|ConvertTo-Json -Depth 12), (New-Object System.Text.UTF8Encoding($false)))
Write-Host "OK: $out ($([math]::Round((Get-Item $out).Length/1KB,1)) KB, $($jogos.Count) jogos)"
