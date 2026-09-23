import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B' };
const MEDS = [
  { id:'1', drug:'Heparin 1000 U/hr IV', patient:'Robert Chen', bed:'4B', due:'11:00', status:'due', route:'IV' },
  { id:'2', drug:'Aspirin 75 mg PO', patient:'Robert Chen', bed:'4B', due:'08:00', status:'given', route:'PO', givenAt:'08:05' },
  { id:'3', drug:'Metformin 500 mg PO', patient:'Robert Chen', bed:'4B', due:'08:00', status:'given', route:'PO', givenAt:'08:05' },
  { id:'4', drug:'Furosemide 40 mg IV', patient:'Margaret Taylor', bed:'5A', due:'10:00', status:'given', route:'IV', givenAt:'10:12' },
  { id:'5', drug:'Bisoprolol 2.5 mg PO', patient:'Margaret Taylor', bed:'5A', due:'08:00', status:'given', route:'PO', givenAt:'08:10' },
  { id:'6', drug:'Amiodarone 200 mg PO', patient:'Aisha Okonkwo', bed:'6C', due:'12:00', status:'due', route:'PO' },
  { id:'7', drug:'Paracetamol 1 g IV', patient:'James Okafor', bed:'7A', due:'11:30', status:'overdue', route:'IV' },
];
export const MedicationAdmin: React.FC<Props> = ({ onBack }) => {
  const [filter, setFilter] = useState<'due'|'all'|'given'>('due');
  const list = MEDS.filter(m => filter==='due' ? (m.status==='due'||m.status==='overdue') : filter==='given' ? m.status==='given' : true);
  return (
    <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
      {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
      <Text style={s.pageTitle}>eMAR · Medication Admin</Text>
      <Text style={s.pageSub}>Record drug administration · Barcode ready</Text>
      <View style={s.filters}>{(['due','all','given'] as const).map(f=>(
        <TouchableOpacity key={f} style={[s.filterBtn, filter===f && s.filterOn]} onPress={()=>setFilter(f)}>
          <Text style={[s.filterText, filter===f && s.filterTextOn]}>{f==='due'?'Due / Overdue':f==='given'?'Given':'All'}</Text>
        </TouchableOpacity>
      ))}</View>
      {list.map(m=>(
        <View key={m.id} style={s.card}>
          <View style={s.top}>
            <View style={[s.status, m.status==='overdue'?s.overdue:m.status==='due'?s.dueBadge:s.given]}>
              <Text style={s.statusText}>{m.status.toUpperCase()}</Text>
            </View>
            <Text style={s.dueTime}>{m.due}</Text>
          </View>
          <Text style={s.drug}>{m.drug}</Text>
          <Text style={s.meta}>{m.patient} · Bed {m.bed} · {m.route}</Text>
          {m.status!=='given' ? (
            <TouchableOpacity style={s.giveBtn}><Text style={s.giveText}>Mark as Given</Text></TouchableOpacity>
          ) : <Text style={s.givenAt}>Given at {m.givenAt}</Text>}
        </View>
      ))}
    </ScrollView>
  );
};
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginBottom:14,marginTop:2},
  filters:{flexDirection:'row',gap:8,marginBottom:16}, filterBtn:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#E2E8F0'}, filterOn:{backgroundColor:C.primary},
  filterText:{fontSize:13,fontWeight:'600',color:'#475569'}, filterTextOn:{color:'#FFF'},
  card:{backgroundColor:C.card,borderRadius:16,padding:14,marginBottom:10,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  top:{flexDirection:'row',justifyContent:'space-between',marginBottom:6}, status:{paddingHorizontal:8,paddingVertical:3,borderRadius:6},
  overdue:{backgroundColor:'#FEE2E2'}, dueBadge:{backgroundColor:'#FEF3C7'}, given:{backgroundColor:'#D1FAE5'}, statusText:{fontSize:10,fontWeight:'800',color:C.text},
  dueTime:{fontSize:12,fontWeight:'600',color:C.muted}, drug:{fontSize:15,fontWeight:'700',color:C.text}, meta:{fontSize:12,color:C.muted,marginTop:3},
  giveBtn:{marginTop:10,backgroundColor:C.teal,borderRadius:10,paddingVertical:10,alignItems:'center'}, giveText:{color:'#FFF',fontWeight:'700',fontSize:13},
  givenAt:{marginTop:8,fontSize:12,color:'#059669',fontWeight:'600'},
});
