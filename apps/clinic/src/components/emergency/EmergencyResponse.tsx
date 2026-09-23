import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
type Props = { onBack?: () => void };
const C = { primary:'#1E3A8A', teal:'#0D9488', bg:'#F0F9FF', card:'#FFF', text:'#0F172A', muted:'#64748B' };
export const EmergencyResponse: React.FC<Props> = ({ onBack }) => (
  <ScrollView style={s.wrap} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:28}}>
    {onBack && <TouchableOpacity onPress={onBack} style={{marginBottom:10}}><Text style={s.back}>← Back</Text></TouchableOpacity>}
    <Text style={s.pageTitle}>Emergency Response</Text><Text style={s.pageSub}>Code Blue · Rapid Response · Crash call</Text>
    <TouchableOpacity style={s.codeBtn} activeOpacity={0.85}>
      <Text style={s.codeIcon}>🚨</Text>
      <Text style={s.codeTitle}>CODE BLUE</Text>
      <Text style={s.codeSub}>Cardiac / Respiratory Arrest</Text>
    </TouchableOpacity>
    <TouchableOpacity style={s.rrtBtn} activeOpacity={0.85}>
      <Text style={s.rrtIcon}>⚡</Text>
      <Text style={s.rrtTitle}>Rapid Response Team</Text>
      <Text style={s.rrtSub}>Deteriorating patient · NEWS2 ≥ 7</Text>
    </TouchableOpacity>
    <View style={s.card}>
      <Text style={s.cardTitle}>Recent Activations</Text>
      <View style={s.row}><Text style={s.muted}>Code Blue · Ward 3</Text><Text style={s.val}>Yesterday 14:22</Text></View>
      <View style={s.row}><Text style={s.muted}>RRT · Bed 4B (this ward)</Text><Text style={s.val}>11:22 today</Text></View>
    </View>
    <View style={s.card}>
      <Text style={s.cardTitle}>Emergency Contacts</Text>
      <View style={s.row}><Text style={s.muted}>Crash Team</Text><Text style={s.val}>Ext 2222</Text></View>
      <View style={s.row}><Text style={s.muted}>Anaesthetics On-call</Text><Text style={s.val}>Ext 2287</Text></View>
      <View style={s.row}><Text style={s.muted}>ICU Outreach</Text><Text style={s.val}>Ext 3309</Text></View>
    </View>
  </ScrollView>
);
const s = StyleSheet.create({
  wrap:{flex:1,backgroundColor:C.bg,paddingHorizontal:16,paddingTop:16}, back:{fontSize:14,color:C.teal,fontWeight:'600'},
  pageTitle:{fontSize:20,fontWeight:'800',color:C.text}, pageSub:{fontSize:13,color:C.muted,marginBottom:16,marginTop:2},
  codeBtn:{backgroundColor:'#FEF2F2',borderRadius:18,padding:24,alignItems:'center',marginBottom:12,borderWidth:2,borderColor:'#FECACA'},
  codeIcon:{fontSize:36,marginBottom:8}, codeTitle:{fontSize:22,fontWeight:'800',color:'#991B1B'}, codeSub:{fontSize:13,color:'#7F1D1D',marginTop:4},
  rrtBtn:{backgroundColor:'#FFFBEB',borderRadius:18,padding:20,alignItems:'center',marginBottom:16,borderWidth:2,borderColor:'#FDE68A'},
  rrtIcon:{fontSize:28,marginBottom:6}, rrtTitle:{fontSize:18,fontWeight:'800',color:'#92400E'}, rrtSub:{fontSize:13,color:'#78350F',marginTop:4},
  card:{backgroundColor:C.card,borderRadius:16,padding:16,marginBottom:12,shadowColor:'#0F172A',shadowOpacity:0.05,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2},
  cardTitle:{fontSize:15,fontWeight:'700',color:C.text,marginBottom:12}, row:{flexDirection:'row',justifyContent:'space-between',marginBottom:8},
  muted:{fontSize:13,color:C.muted}, val:{fontSize:13,fontWeight:'600',color:C.text},
});
