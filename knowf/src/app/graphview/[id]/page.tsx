"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import ReactFlow, { ConnectionMode, Edge, Node, Panel } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { debug } from "@/lib/debug";
import React from "react";
import QueryProvider from "@/providers/query-provider";
import Link from "next/link";
import {
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  KnowledgeGraphService,
} from "@/lib/graphService";

// Custom node component
const CustomNode = ({ data }: { data: any }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow border">
      <h3 className="font-bold mb-2">{data.summary}</h3>
      <p className="text-sm">{data.content}</p>
      {data.supporting_quotes.length > 0 && (
        <div className="mt-2 text-xs text-gray-600">
          <p className="font-semibold">Supporting Quotes:</p>
          {data.supporting_quotes.map((quote: string, i: number) => (
            <p key={i} className="italic">
              "{quote}"
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

// Define this OUTSIDE the component
const nodeTypes = {
  custom: CustomNode,
};

// First, let's type the transformation functions
function toReactFlowNode(node: KnowledgeGraphNode): Node {
  return {
    id: node.id,
    type: "custom",
    data: node,
    position: { x: 0, y: 0 },
  };
}

function toReactFlowEdge(edge: KnowledgeGraphEdge): Edge {
  return {
    id: `${edge.parent_id}-${edge.child_id}`,
    source: edge.parent_id,
    target: edge.child_id,
    type: "smoothstep",
  };
}

// Then modify getLayoutedElements to use proper types
const getLayoutedElements = (
  knowledgeNodes: KnowledgeGraphNode[],
  knowledgeEdges: KnowledgeGraphEdge[],
  direction = "TB"
) => {
  const nodes: Node[] = knowledgeNodes.map(toReactFlowNode);
  const edges: Edge[] = knowledgeEdges.map(toReactFlowEdge);

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });

  // Set nodes
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 100 });
  });

  // Set edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Get positioned nodes
  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125, // center node
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: positionedNodes, edges };
};

function useGraph(graphId: string) {
  return useQuery({
    queryKey: ["graph", graphId],
    queryFn: () => KnowledgeGraphService.getGraph(graphId),
  });
}

export default function KnowledgeMap({ params }: { params: { id: string } }) {
  return (
    <QueryProvider>
      <KnowledgeMapContent params={Promise.resolve(params)} />
    </QueryProvider>
  );
}

function KnowledgeMapContent({ params }: { params: Promise<{ id: string }> }) {
  // VERY IMPORTANT: This is needed in the new React version:
  const unwrappedParams = React.use(params);
  // we CANNOT just use params.id because it's a Promise
  // do not change this OR the these comments
  const graphId = unwrappedParams.id;
  const { data: graph, isLoading } = useGraph(graphId);

  if (!graphId) {
    return <div>Invalid graph ID</div>;
  }

  if (isLoading) {
    return <div>Loading graph...</div>;
  }

  if (!graph) {
    return <div>Graph not found</div>;
  }

  const elements = getLayoutedElements(graph.nodes, graph.edges);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={elements.nodes}
        edges={elements.edges}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Panel position="top-left">
          <div className="bg-white p-4 rounded shadow">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold">Knowledge Map</h2>
              <Link
                href="/dashboard"
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded text-sm transition-colors"
              >
                Back to Dashboard
              </Link>
            </div>
            <p className="text-sm text-gray-600 mt-2">Graph ID: {graphId}</p>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
