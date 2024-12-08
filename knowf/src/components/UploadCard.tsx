"use client";
import { Flex, Text, Card, IconButton } from "@radix-ui/themes";
import { FileIcon, TransformIcon } from "@radix-ui/react-icons";


interface UploadCardProps {

  uploading: boolean;

  uploaded: boolean;

  documents: Document[];

  isGeneratingState: boolean;

  handleFileUpload: React.ChangeEventHandler<HTMLInputElement>;

  handleStartSession: React.MouseEventHandler<HTMLButtonElement>;

}

export const UploadCard = ({
  uploading,
  uploaded,
  documents,
  isGeneratingState,
  handleFileUpload,
  handleStartSession,
}: UploadCardProps) => {

  let component

  if (uploading) {
    component = (     
      <Card 
        style={{
          display: "flex",
          width: "300px",
          height: "490px",
          padding: "var(--space-4)",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center"
        }}
      >   
        <Flex 
          className="pdf-flavour-text"
          display="flex"
          direction="column"
          justify="center"
          align="center"
          gap="3"
        >
          <Text size="3" weight="regular">Uploading...</Text>
        </Flex>
      </Card>
    )
  } else {
    if (uploaded) {
      component = (
        <Card 
          style={{
            display: "flex",
            width: "300px",
            height: "490px",
            padding: "var(--space-4)",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <Flex 
            style={{alignSelf: "stretch"}}
            display="flex" 
            height="40px"
            p="3"
            align="start"
            gap="3"
          />
          <Flex 
            className="pdf-flavour-text"
            display="flex"
            direction="column"
            justify="center"
            align="center"
            gap="3"
          >
            <FileIcon width="24" height="24"/>
            <Text size="1" weight="light">{documents?.at(-1)?.title}</Text>
          </Flex>
          <Flex 
            className="generate-graph-button"
            style={{
              alignSelf: "stretch"
            }}
            display="flex"
            justify="end"
            align="center"
            gap="3"
          >
            <IconButton disabled={isGeneratingState} onClick={handleStartSession} size="3" variant="solid" >
              <TransformIcon/>
            </IconButton>
          </Flex>
        </Card>
      )
    } else {
      component = (
        <Card 
          style={{
            display: "flex",
            width: "300px",
            height: "490px",
            padding: "var(--space-4)",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center"
          }}
        >   
          <Flex 
            className="pdf-flavour-text"
            display="flex"
            direction="column"
            justify="center"
            align="center"
            gap="3"
          >
            <label>
              <input
                type="file"
                onChange={handleFileUpload}
                style={{ display: 'none', cursor: 'pointer' }}
              />
              Upload a PDF to get started
            </label>
          </Flex>
        </Card>
      )
    }
  }

  return component
}